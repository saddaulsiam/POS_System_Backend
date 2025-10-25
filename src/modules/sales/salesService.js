import { PrismaClient } from "@prisma/client";
import { calculateTax, generateReceiptId, logAudit } from "../../utils/helpers.js";
import { checkAndCreateAlerts } from "../notifications/notificationService.js";

const prisma = new PrismaClient();

export const getSales = async (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;
  const where = {};
  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) where.createdAt.lte = new Date(query.endDate);
  }
  if (query.employeeId) where.employeeId = parseInt(query.employeeId);
  if (query.customerId) where.customerId = parseInt(query.customerId);
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, username: true } },
        customer: { select: { id: true, name: true, phoneNumber: true, email: true } },
        saleItems: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            productVariant: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);

  return {
    data: sales,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getSaleById = async (identifier) => {
  return prisma.sale.findFirst({
    where: {
      OR: [{ id: isNaN(identifier) ? -1 : parseInt(identifier) }, { receiptId: identifier }],
    },
    include: {
      employee: { select: { id: true, name: true, username: true } },
      customer: { select: { id: true, name: true, phoneNumber: true, email: true } },
      saleItems: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              isWeighted: true,
              category: { select: { name: true } },
            },
          },
          productVariant: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
            },
          },
        },
      },
    },
  });
};

export const createSale = async (body, user, ip, userAgent) => {
  const {
    items,
    customerId,
    paymentMethod,
    cashReceived,
    discountAmount = 0,
    discountReason,
    paymentSplits,
    notes,
    loyaltyDiscount = 0,
  } = body;
  const employeeId = user.id;

  // Validate payment splits for MIXED payment
  if (paymentMethod === "MIXED") {
    if (!paymentSplits || paymentSplits.length < 2) {
      throw new Error("MIXED payment requires at least 2 payment splits");
    }
  }

  // Start transaction
  let subtotal = 0;
  let totalTax = 0;
  const saleItemsData = [];
  const alertProductIds = [];
  const result = await prisma.$transaction(async (tx) => {
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId, isActive: true },
      });
      if (!product) throw new Error(`Product with ID ${item.productId} not found or inactive`);
      let variant = null;
      let stockQuantity = product.stockQuantity;
      let productName = product.name;
      if (item.productVariantId) {
        variant = await tx.productVariant.findUnique({
          where: { id: item.productVariantId, isActive: true },
        });
        if (!variant) throw new Error(`Product variant with ID ${item.productVariantId} not found or inactive`);
        if (variant.productId !== item.productId)
          throw new Error(`Variant ${item.productVariantId} does not belong to product ${item.productId}`);
        stockQuantity = variant.stockQuantity;
        productName = `${product.name} - ${variant.name}`;
      }
      if (stockQuantity < item.quantity) {
        throw new Error(
          `Insufficient stock for ${productName}. Available: ${stockQuantity}, Requested: ${item.quantity}`
        );
      }
      const price = item.price || (variant ? variant.sellingPrice : product.sellingPrice);
      const discount = item.discount || 0;
      const itemSubtotal = price * item.quantity - discount;
      const itemTax = calculateTax(itemSubtotal, product.taxRate);
      subtotal += itemSubtotal;
      totalTax += itemTax;
      saleItemsData.push({
        productId: item.productId,
        productVariantId: item.productVariantId || null,
        quantity: item.quantity,
        priceAtSale: price,
        discount,
        subtotal: itemSubtotal,
      });
      if (variant) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        alertProductIds.push(variant.id);
      } else {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        alertProductIds.push(item.productId);
      }
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          productVariantId: item.productVariantId || null,
          movementType: "SALE",
          quantity: -item.quantity,
          reason: "Sale transaction",
          createdBy: employeeId,
        },
      });
    }
    const finalAmount = subtotal + totalTax - discountAmount - loyaltyDiscount;
    const receiptId = generateReceiptId();
    if (paymentMethod === "MIXED") {
      const totalSplitAmount = paymentSplits.reduce((sum, split) => sum + split.amount, 0);
      if (Math.abs(totalSplitAmount - finalAmount) > 0.01) {
        throw new Error(`Payment splits total (${totalSplitAmount}) must equal final amount (${finalAmount})`);
      }
    }
    // --- Loyalty points calculation ---
    let pointsEarned = 0;
    let qualifiedTier = null;
    if (customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: customerId },
        select: { loyaltyTier: true, loyaltyPoints: true },
      });
      if (customer) {
        const settings = await tx.pOSSettings.findFirst({ select: { loyaltyPointsPerUnit: true } });
        const pointsPerUnit = settings?.loyaltyPointsPerUnit || 10;
        const tierConfig = await tx.loyaltyTierConfig.findUnique({ where: { tier: customer.loyaltyTier } });
        const defaultMultipliers = { BRONZE: 1.0, SILVER: 1.25, GOLD: 1.5, PLATINUM: 2.0 };
        const multiplier = tierConfig?.pointsMultiplier || defaultMultipliers[customer.loyaltyTier] || 1.0;
        const basePoints = Math.floor(finalAmount / pointsPerUnit);
        const bonusPoints = Math.floor(basePoints * (multiplier - 1));
        pointsEarned = basePoints + bonusPoints;
      }
    }
    const sale = await tx.sale.create({
      data: {
        receiptId,
        employeeId,
        customerId,
        subtotal,
        taxAmount: totalTax,
        discountAmount,
        loyaltyDiscount,
        discountReason,
        finalAmount,
        paymentMethod,
        cashReceived,
        changeGiven: paymentMethod === "CASH" ? (cashReceived || 0) - finalAmount : 0,
        notes,
        saleItems: { create: saleItemsData },
        paymentSplits: paymentMethod === "MIXED" ? { create: paymentSplits } : undefined,
        pointsEarned,
      },
      include: {
        employee: { select: { id: true, name: true, username: true } },
        customer: { select: { id: true, name: true, phoneNumber: true } },
        saleItems: {
          include: {
            product: { select: { id: true, name: true, sku: true, isWeighted: true } },
            productVariant: { select: { id: true, name: true, sku: true } },
          },
        },
        paymentSplits: paymentMethod === "MIXED",
      },
    });
    // --- Update customer points, tier, and create points transaction ---
    if (customerId && pointsEarned > 0) {
      await tx.customer.update({ where: { id: customerId }, data: { loyaltyPoints: { increment: pointsEarned } } });
      await tx.pointsTransaction.create({
        data: {
          customerId,
          saleId: sale.id,
          type: "EARNED",
          points: pointsEarned,
          description: `Purchase ${sale.receiptId}: ${pointsEarned} points earned`,
        },
      });
      // Calculate lifetime points and tier
      const earnedPointsSum = await tx.pointsTransaction.aggregate({
        where: { customerId, points: { gt: 0 } },
        _sum: { points: true },
      });
      const lifetimePoints = earnedPointsSum._sum.points || 0;
      const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
      const LOYALTY_TIERS = {
        BRONZE: { min: 0 },
        SILVER: { min: 500 },
        GOLD: { min: 1500 },
        PLATINUM: { min: 3000 },
      };
      const customerTier = sale.customer?.loyaltyTier || "BRONZE";
      const currentTierIndex = TIER_ORDER.indexOf(customerTier);
      qualifiedTier = (() => {
        if (lifetimePoints >= LOYALTY_TIERS.PLATINUM.min) return "PLATINUM";
        if (lifetimePoints >= LOYALTY_TIERS.GOLD.min) return "GOLD";
        if (lifetimePoints >= LOYALTY_TIERS.SILVER.min) return "SILVER";
        return "BRONZE";
      })();
      const qualifiedTierIndex = TIER_ORDER.indexOf(qualifiedTier);
      if (qualifiedTierIndex > currentTierIndex) {
        await tx.customer.update({ where: { id: customerId }, data: { loyaltyTier: qualifiedTier } });
        await tx.pointsTransaction.create({
          data: {
            customerId,
            type: "ADJUSTED",
            points: 0,
            description: `🎉 Tier upgraded from ${customerTier} to ${qualifiedTier}! You've earned ${lifetimePoints} lifetime points.`,
          },
        });
      }
    }
    return { sale, finalAmount };
  });
  // Run alerts outside transaction
  for (const pid of alertProductIds) {
    checkAndCreateAlerts(pid);
  }
  logAudit({
    userId: user.id,
    action: "CREATE",
    entity: "Sale",
    entityId: result.sale.id,
    details: JSON.stringify({
      receiptId: result.sale.receiptId,
      itemCount: items.length,
      finalAmount: result.sale.finalAmount,
      paymentMethod,
      splitPayments: paymentMethod === "MIXED" ? paymentSplits.length : 0,
    }),
    ipAddress: ip,
    userAgent: userAgent || "",
  });

  return result.sale;
};

export const processReturn = async (id, body, user) => {
  const { items, reason, refundMethod, restockingFee = 0, exchangeProductId, notes } = body;
  const saleId = parseInt(id);
  const result = await prisma.$transaction(async (tx) => {
    const originalSale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        items: { include: { product: true, productVariant: true } },
        customer: true,
      },
    });
    if (!originalSale) throw new Error("Original sale not found");
    const saleDate = new Date(originalSale.createdAt);
    const daysSinceSale = Math.floor((Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
    const returnPolicyDays = parseInt(process.env.RETURN_POLICY_DAYS || "30");
    if (daysSinceSale > returnPolicyDays)
      throw new Error(`Return period expired. Items can only be returned within ${returnPolicyDays} days`);
    const existingReturns = await tx.sale.findMany({
      where: { notes: { contains: `Return for sale ${originalSale.receiptId}` } },
      include: { items: true },
    });
    let refundAmount = 0;
    const returnItems = [];
    for (const returnItem of items) {
      const originalSaleItem = originalSale.items.find((item) => item.id === returnItem.saleItemId);
      if (!originalSaleItem) throw new Error(`Sale item ${returnItem.saleItemId} not found in original sale`);
      let alreadyReturned = 0;
      for (const existingReturn of existingReturns) {
        const returnedItem = existingReturn.items.find((item) => item.productId === originalSaleItem.productId);
        if (returnedItem) alreadyReturned += Math.abs(returnedItem.quantity);
      }
      const remainingQuantity = originalSaleItem.quantity - alreadyReturned;
      if (returnItem.quantity > remainingQuantity) {
        throw new Error(
          `Cannot return ${returnItem.quantity} of "${originalSaleItem.product.name}". Original: ${originalSaleItem.quantity}, Already returned: ${alreadyReturned}, Remaining: ${remainingQuantity}`
        );
      }
      const itemRefundAmount =
        originalSaleItem.unitPrice * returnItem.quantity -
        (originalSaleItem.discount || 0) * (returnItem.quantity / originalSaleItem.quantity);
      refundAmount += itemRefundAmount;
      returnItems.push({
        productId: originalSaleItem.productId,
        productVariantId: originalSaleItem.productVariantId,
        quantity: -returnItem.quantity,
        unitPrice: originalSaleItem.unitPrice,
        discount: (originalSaleItem.discount || 0) * (returnItem.quantity / originalSaleItem.quantity),
        total: -itemRefundAmount,
      });
      const condition = returnItem.condition || "NEW";
      const shouldRestock = ["NEW", "OPENED"].includes(condition);
      if (shouldRestock) {
        if (originalSaleItem.productVariantId) {
          await tx.productVariant.update({
            where: { id: originalSaleItem.productVariantId },
            data: { stockQuantity: { increment: returnItem.quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: originalSaleItem.productId },
            data: { stockQuantity: { increment: returnItem.quantity } },
          });
        }
        await tx.stockMovement.create({
          data: {
            productId: originalSaleItem.productId,
            productVariantId: originalSaleItem.productVariantId,
            movementType: "RETURN",
            quantity: returnItem.quantity,
            reason: `Return - ${condition} - ${reason}`,
            reference: originalSale.receiptId,
            createdBy: user.id,
          },
        });
      } else {
        await tx.stockMovement.create({
          data: {
            productId: originalSaleItem.productId,
            productVariantId: originalSaleItem.productVariantId,
            movementType: "ADJUSTMENT",
            quantity: -returnItem.quantity,
            reason: `Returned as ${condition} - ${reason}`,
            reference: originalSale.receiptId,
            createdBy: user.id,
          },
        });
      }
    }
    const finalRefundAmount = Math.max(0, refundAmount - restockingFee);
    if (originalSale.pointsEarned && originalSale.pointsEarned > 0 && originalSale.customerId) {
      const pointsToDeduct = Math.floor(originalSale.pointsEarned * (refundAmount / originalSale.finalAmount));
      await tx.pointsTransaction.create({
        data: {
          customerId: originalSale.customerId,
          type: "ADJUSTED",
          points: -pointsToDeduct,
          description: `Points deducted for return of sale ${originalSale.receiptId}`,
          saleId: originalSale.id,
        },
      });
      await tx.customer.update({
        where: { id: originalSale.customerId },
        data: { loyaltyPoints: { decrement: pointsToDeduct } },
      });
    }
    let refundPaymentMethod = refundMethod;
    if (refundMethod === "ORIGINAL_PAYMENT") {
      refundPaymentMethod = originalSale.paymentMethod;
    }
    const returnSale = await tx.sale.create({
      data: {
        receiptId: `RET-${generateReceiptId()}`,
        employeeId: user.id,
        customerId: originalSale.customerId,
        subtotal: -refundAmount,
        taxAmount: 0,
        discountAmount: restockingFee,
        finalAmount: -finalRefundAmount,
        paymentMethod: refundPaymentMethod,
        paymentStatus: refundMethod === "STORE_CREDIT" ? "PENDING" : "COMPLETED",
        notes: `Return for sale ${originalSale.receiptId}. Reason: ${reason}${notes ? ` | ${notes}` : ""}${
          restockingFee > 0 ? ` | Restocking fee: $${restockingFee.toFixed(2)}` : ""
        }`,
        items: { create: returnItems },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
        customer: true,
        items: { include: { product: true, productVariant: true } },
      },
    });
    if (refundMethod === "STORE_CREDIT" && originalSale.customerId) {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 6);
      await tx.loyaltyReward.create({
        data: {
          customerId: originalSale.customerId,
          rewardType: "STORE_CREDIT",
          rewardValue: finalRefundAmount,
          pointsCost: 0,
          description: `Store credit from return ${returnSale.receiptId}`,
          expiresAt: expiresAt,
        },
      });
    }
    await tx.sale.update({
      where: { id: originalSale.id },
      data: {
        paymentStatus: "REFUNDED",
        notes: originalSale.notes
          ? `${originalSale.notes} | Partial return processed: ${returnSale.receiptId}`
          : `Partial return processed: ${returnSale.receiptId}`,
      },
    });
    return {
      returnSale,
      refundAmount: finalRefundAmount,
      restockingFee,
      refundMethod,
      originalSaleId: originalSale.id,
      message:
        refundMethod === "STORE_CREDIT"
          ? "Return processed. Store credit has been added to customer account."
          : "Return processed successfully.",
    };
  });
  return result;
};

export const getReturnHistory = async (id) => {
  const originalSale = await prisma.sale.findUnique({
    where: { id: parseInt(id) },
    select: { receiptId: true },
  });
  if (!originalSale) return null;
  const returns = await prisma.sale.findMany({
    where: {
      notes: {
        contains: `Return for sale ${originalSale.receiptId}`,
      },
    },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
          productVariant: { select: { id: true, name: true, sku: true } },
        },
      },
      employee: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return {
    totalReturns: returns.length,
    totalRefunded: returns.reduce((sum, ret) => sum + Math.abs(ret.finalAmount), 0),
    returns,
  };
};

export const getAllReturns = async (query) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;
  const where = {
    receiptId: {
      startsWith: "RET-",
    },
  };
  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) where.createdAt.lte = new Date(query.endDate);
  }
  const [returns, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            productVariant: { select: { id: true, name: true } },
          },
        },
        employee: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);
  return {
    returns,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getSalesSummary = async (query) => {
  const startDate = query.startDate ? new Date(query.startDate) : new Date(new Date().setHours(0, 0, 0, 0));
  const endDate = query.endDate ? new Date(query.endDate) : new Date(new Date().setHours(23, 59, 59, 999));
  const summary = await prisma.sale.aggregate({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      finalAmount: { gt: 0 },
    },
    _sum: {
      finalAmount: true,
      taxAmount: true,
      discountAmount: true,
    },
    _count: true,
  });
  const paymentMethodBreakdown = await prisma.sale.groupBy({
    by: ["paymentMethod"],
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      finalAmount: { gt: 0 },
    },
    _sum: {
      finalAmount: true,
    },
    _count: true,
  });
  return {
    period: { startDate, endDate },
    summary: {
      totalSales: summary._sum.finalAmount || 0,
      totalTransactions: summary._count,
      totalTax: summary._sum.taxAmount || 0,
      totalDiscounts: summary._sum.discountAmount || 0,
      averageTransaction: summary._count > 0 ? (summary._sum.finalAmount || 0) / summary._count : 0,
    },
    paymentMethodBreakdown,
  };
};

export const voidSale = async (id, body, user) => {
  const { reason, password, restoreStock = true } = body;
  const employeeId = user.id;
  const settings = await prisma.pOSSettings.findFirst();
  if (settings?.requirePasswordOnVoid && password) {
    const bcrypt = await import("bcryptjs");
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || !(await bcrypt.default.compare(password, employee.password))) {
      throw new Error("Invalid password");
    }
  }
  const sale = await prisma.sale.findUnique({
    where: { id: parseInt(id) },
    include: {
      items: { include: { product: true, variant: true } },
      customer: true,
      paymentSplits: true,
    },
  });
  if (!sale) throw new Error("Sale not found");
  if (sale.status === "VOIDED") throw new Error("Sale is already voided");
  const result = await prisma.$transaction(async (tx) => {
    const voidedSale = await tx.sale.update({
      where: { id: parseInt(id) },
      data: { status: "VOIDED" },
    });
    if (restoreStock) {
      for (const item of sale.items) {
        if (item.variantId) {
          await tx.productVariant.update({
            loyaltyDiscount,
            where: { id: item.variantId },
            data: { stock: { increment: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              variantId: item.variantId,
              type: "ADJUSTMENT",
              quantity: item.quantity,
              reason: `Voided sale #${sale.receiptId}`,
              employeeId,
            },
          });
        } else {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              type: "ADJUSTMENT",
              quantity: item.quantity,
              reason: `Voided sale #${sale.receiptId}`,
              employeeId,
            },
          });
        }
      }
    }
    if (sale.customerId && sale.pointsEarned > 0) {
      const customer = await tx.customer.update({
        where: { id: sale.customerId },
        data: {
          points: { decrement: sale.pointsEarned },
          lifetimePoints: { decrement: sale.pointsEarned },
        },
      });
      const tierOrder = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
      const calculateTier = (lifetimePoints) => {
        if (lifetimePoints >= 3000) return "PLATINUM";
        if (lifetimePoints >= 1500) return "GOLD";
        if (lifetimePoints >= 500) return "SILVER";
        return "BRONZE";
      };
      const newTier = calculateTier(customer.lifetimePoints);
      if (newTier !== customer.tier) {
        await tx.customer.update({ where: { id: sale.customerId }, data: { tier: newTier } });
      }
      await tx.pointsTransaction.create({
        data: {
          customerId: sale.customerId,
          type: "DEDUCTION",
          points: sale.pointsEarned,
          description: `Reversed from voided sale #${sale.receiptId}`,
          saleId: sale.id,
        },
      });
    }
    if (sale.customerId && sale.pointsRedeemed > 0) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: { points: { increment: sale.pointsRedeemed } },
      });
      await tx.pointsTransaction.create({
        data: {
          customerId: sale.customerId,
          type: "EARNED",
          points: sale.pointsRedeemed,
          description: `Refunded from voided sale #${sale.receiptId}`,
          saleId: sale.id,
        },
      });
    }
    await tx.auditLog.create({
      data: {
        employeeId,
        action: "VOID_SALE",
        entityType: "Sale",
        entityId: sale.id,
        details: JSON.stringify({
          receiptId: sale.receiptId,
          reason,
          total: sale.total,
          restoreStock,
          itemCount: sale.items.length,
        }),
      },
    });
    return voidedSale;
  });
  return {
    message: "Sale voided successfully",
    sale: result,
  };
};
