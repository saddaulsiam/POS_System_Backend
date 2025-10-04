const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { generateReceiptId, calculateTax } = require("../utils/helpers");

const router = express.Router();
const prisma = new PrismaClient();

// Get all sales with pagination and filtering
router.get(
  "/",
  [
    authenticateToken,
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("startDate").optional().isISO8601().withMessage("Start date must be valid ISO date"),
    query("endDate").optional().isISO8601().withMessage("End date must be valid ISO date"),
    query("employeeId").optional().isInt().withMessage("Employee ID must be an integer"),
    query("customerId").optional().isInt().withMessage("Customer ID must be an integer"),
    query("paymentMethod").optional().isString().withMessage("Payment method must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const where = {};

      if (req.query.startDate || req.query.endDate) {
        where.createdAt = {};
        if (req.query.startDate) where.createdAt.gte = new Date(req.query.startDate);
        if (req.query.endDate) where.createdAt.lte = new Date(req.query.endDate);
      }

      if (req.query.employeeId) where.employeeId = parseInt(req.query.employeeId);
      if (req.query.customerId) where.customerId = parseInt(req.query.customerId);
      if (req.query.paymentMethod) where.paymentMethod = req.query.paymentMethod;

      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where,
          include: {
            employee: { select: { id: true, name: true, username: true } },
            customer: { select: { id: true, name: true, phoneNumber: true } },
            saleItems: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.sale.count({ where }),
      ]);

      res.json({
        data: sales,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get sales error:", error);
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  }
);

// Get sale by ID or receipt ID
router.get("/:identifier", authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;

    const sale = await prisma.sale.findFirst({
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
          },
        },
      },
    });

    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    res.json(sale);
  } catch (error) {
    console.error("Get sale error:", error);
    res.status(500).json({ error: "Failed to fetch sale" });
  }
});

// Create new sale
router.post(
  "/",
  [
    authenticateToken,
    body("items").isArray({ min: 1 }).withMessage("Items array is required and must have at least one item"),
    body("items.*.productId").isInt().withMessage("Product ID is required for each item"),
    body("items.*.quantity").isFloat({ min: 0.001 }).withMessage("Quantity must be greater than 0"),
    body("items.*.price").optional().isFloat({ min: 0 }).withMessage("Price must be non-negative"),
    body("items.*.discount").optional().isFloat({ min: 0 }).withMessage("Discount must be non-negative"),
    body("customerId").optional().isInt().withMessage("Customer ID must be an integer"),
    body("paymentMethod")
      .isIn(["CASH", "CARD", "MOBILE_PAYMENT", "STORE_CREDIT", "MIXED"])
      .withMessage("Invalid payment method"),
    body("cashReceived").optional().isFloat({ min: 0 }).withMessage("Cash received must be non-negative"),
    body("discountAmount").optional().isFloat({ min: 0 }).withMessage("Discount amount must be non-negative"),
    body("discountReason").optional().isString().withMessage("Discount reason must be a string"),
    body("paymentSplits").optional().isArray().withMessage("Payment splits must be an array"),
    body("paymentSplits.*.paymentMethod")
      .optional()
      .isIn(["CASH", "CARD", "MOBILE_PAYMENT", "STORE_CREDIT"])
      .withMessage("Invalid split payment method"),
    body("paymentSplits.*.amount").optional().isFloat({ min: 0.01 }).withMessage("Split amount must be > 0"),
    body("notes").optional().isString().withMessage("Notes must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        items,
        customerId,
        paymentMethod,
        cashReceived,
        discountAmount = 0,
        discountReason,
        paymentSplits,
        notes,
      } = req.body;
      const employeeId = req.user.id;

      // Validate payment splits for MIXED payment
      if (paymentMethod === "MIXED") {
        if (!paymentSplits || paymentSplits.length < 2) {
          return res.status(400).json({ error: "MIXED payment requires at least 2 payment splits" });
        }
      }

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Validate products and calculate totals
        let subtotal = 0;
        let totalTax = 0;
        const saleItemsData = [];

        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId, isActive: true },
          });

          if (!product) {
            throw new Error(`Product with ID ${item.productId} not found or inactive`);
          }

          // Check stock availability
          if (product.stockQuantity < item.quantity) {
            throw new Error(
              `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}`
            );
          }

          const price = item.price || product.sellingPrice;
          const discount = item.discount || 0;
          const itemSubtotal = price * item.quantity - discount;
          const itemTax = calculateTax(itemSubtotal, product.taxRate);

          subtotal += itemSubtotal;
          totalTax += itemTax;

          saleItemsData.push({
            productId: item.productId,
            quantity: item.quantity,
            priceAtSale: price,
            discount,
            subtotal: itemSubtotal,
          });

          // Update stock
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { decrement: item.quantity } },
          });

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              movementType: "SALE",
              quantity: -item.quantity,
              reason: "Sale transaction",
              createdBy: employeeId,
            },
          });
        }

        const finalAmount = subtotal + totalTax - discountAmount;
        const receiptId = generateReceiptId();

        // Validate split payment amounts
        if (paymentMethod === "MIXED") {
          const totalSplitAmount = paymentSplits.reduce((sum, split) => sum + split.amount, 0);
          if (Math.abs(totalSplitAmount - finalAmount) > 0.01) {
            throw new Error(`Payment splits total (${totalSplitAmount}) must equal final amount (${finalAmount})`);
          }
        }

        // Create sale
        const sale = await tx.sale.create({
          data: {
            receiptId,
            employeeId,
            customerId,
            subtotal,
            taxAmount: totalTax,
            discountAmount,
            discountReason,
            finalAmount,
            paymentMethod,
            cashReceived,
            changeGiven: paymentMethod === "CASH" ? (cashReceived || 0) - finalAmount : 0,
            notes,
            saleItems: {
              create: saleItemsData,
            },
            paymentSplits:
              paymentMethod === "MIXED"
                ? {
                    create: paymentSplits,
                  }
                : undefined,
          },
          include: {
            employee: { select: { id: true, name: true, username: true } },
            customer: { select: { id: true, name: true, phoneNumber: true } },
            saleItems: {
              include: {
                product: { select: { id: true, name: true, sku: true, isWeighted: true } },
              },
            },
            paymentSplits: paymentMethod === "MIXED",
          },
        });

        // Update customer loyalty points if customer is provided
        if (customerId) {
          const loyaltyPoints = Math.floor(finalAmount / 10); // 1 point per $10 spent
          await tx.customer.update({
            where: { id: customerId },
            data: { loyaltyPoints: { increment: loyaltyPoints } },
          });
        }

        return sale;
      });

      // Log audit event for sale creation
      const { logAudit } = require("../utils/helpers");
      logAudit({
        userId: req.user.id,
        action: "CREATE",
        entity: "Sale",
        entityId: result.id,
        details: JSON.stringify({
          receiptId: result.receiptId,
          itemCount: items.length,
          finalAmount: result.finalAmount,
          paymentMethod,
          splitPayments: paymentMethod === "MIXED" ? paymentSplits.length : 0,
        }),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || "",
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Create sale error:", error);
      res.status(500).json({ error: error.message || "Failed to create sale" });
    }
  }
);

// Process return/refund (Enhanced with Option 7 features)
router.post(
  "/:id/return",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("items").isArray({ min: 1 }).withMessage("Items array is required"),
    body("items.*.saleItemId").isInt().withMessage("Sale item ID is required"),
    body("items.*.quantity").isFloat({ min: 0.001 }).withMessage("Return quantity must be greater than 0"),
    body("items.*.condition")
      .optional()
      .isIn(["NEW", "OPENED", "DAMAGED", "DEFECTIVE"])
      .withMessage("Invalid condition"),
    body("reason").isString().notEmpty().withMessage("Return reason is required"),
    body("refundMethod")
      .isIn(["CASH", "ORIGINAL_PAYMENT", "STORE_CREDIT", "EXCHANGE"])
      .withMessage("Invalid refund method"),
    body("restockingFee").optional().isFloat({ min: 0 }).withMessage("Restocking fee must be a positive number"),
    body("exchangeProductId").optional().isInt().withMessage("Exchange product ID must be an integer"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { items, reason, refundMethod, restockingFee = 0, exchangeProductId, notes } = req.body;
      const saleId = parseInt(id);

      const result = await prisma.$transaction(async (tx) => {
        // Get original sale with all details
        const originalSale = await tx.sale.findUnique({
          where: { id: saleId },
          include: {
            items: {
              include: {
                product: true,
                productVariant: true,
              },
            },
            customer: true,
          },
        });

        if (!originalSale) {
          throw new Error("Original sale not found");
        }

        // Check if sale is within return period (e.g., 30 days)
        const saleDate = new Date(originalSale.createdAt);
        const daysSinceSale = Math.floor((Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
        const returnPolicyDays = parseInt(process.env.RETURN_POLICY_DAYS || "30");

        if (daysSinceSale > returnPolicyDays) {
          throw new Error(`Return period expired. Items can only be returned within ${returnPolicyDays} days`);
        }

        // Check if sale already has partial returns
        const existingReturns = await tx.sale.findMany({
          where: {
            notes: {
              contains: `Return for sale ${originalSale.receiptId}`,
            },
          },
          include: {
            items: true,
          },
        });

        let refundAmount = 0;
        const returnItems = [];

        // Process each return item
        for (const returnItem of items) {
          const originalSaleItem = originalSale.items.find((item) => item.id === returnItem.saleItemId);

          if (!originalSaleItem) {
            throw new Error(`Sale item ${returnItem.saleItemId} not found in original sale`);
          }

          // Calculate already returned quantity
          let alreadyReturned = 0;
          for (const existingReturn of existingReturns) {
            const returnedItem = existingReturn.items.find((item) => item.productId === originalSaleItem.productId);
            if (returnedItem) {
              alreadyReturned += Math.abs(returnedItem.quantity);
            }
          }

          const remainingQuantity = originalSaleItem.quantity - alreadyReturned;

          if (returnItem.quantity > remainingQuantity) {
            throw new Error(
              `Cannot return ${returnItem.quantity} of "${originalSaleItem.product.name}". ` +
                `Original: ${originalSaleItem.quantity}, Already returned: ${alreadyReturned}, ` +
                `Remaining: ${remainingQuantity}`
            );
          }

          // Calculate refund amount for this item
          const itemRefundAmount =
            originalSaleItem.unitPrice * returnItem.quantity -
            (originalSaleItem.discount || 0) * (returnItem.quantity / originalSaleItem.quantity);

          refundAmount += itemRefundAmount;

          returnItems.push({
            productId: originalSaleItem.productId,
            productVariantId: originalSaleItem.productVariantId,
            quantity: -returnItem.quantity, // Negative for return
            unitPrice: originalSaleItem.unitPrice,
            discount: (originalSaleItem.discount || 0) * (returnItem.quantity / originalSaleItem.quantity),
            total: -itemRefundAmount,
          });

          // Return stock based on item condition
          const condition = returnItem.condition || "NEW";
          const shouldRestock = ["NEW", "OPENED"].includes(condition);

          if (shouldRestock) {
            // Return to stock
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

            // Create stock movement
            await tx.stockMovement.create({
              data: {
                productId: originalSaleItem.productId,
                productVariantId: originalSaleItem.productVariantId,
                movementType: "RETURN",
                quantity: returnItem.quantity,
                reason: `Return - ${condition} - ${reason}`,
                reference: originalSale.receiptId,
                createdBy: req.user.id,
              },
            });
          } else {
            // Damaged/Defective - don't restock, create adjustment
            await tx.stockMovement.create({
              data: {
                productId: originalSaleItem.productId,
                productVariantId: originalSaleItem.productVariantId,
                movementType: "ADJUSTMENT",
                quantity: -returnItem.quantity,
                reason: `Returned as ${condition} - ${reason}`,
                reference: originalSale.receiptId,
                createdBy: req.user.id,
              },
            });
          }
        }

        // Apply restocking fee if applicable
        const finalRefundAmount = Math.max(0, refundAmount - restockingFee);

        // Deduct returned points if loyalty program used
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

        // Determine payment method for refund
        let refundPaymentMethod = refundMethod;
        if (refundMethod === "ORIGINAL_PAYMENT") {
          refundPaymentMethod = originalSale.paymentMethod;
        }

        // Create return sale
        const returnSale = await tx.sale.create({
          data: {
            receiptId: `RET-${generateReceiptId()}`,
            employeeId: req.user.id,
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
            items: {
              create: returnItems,
            },
          },
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
            customer: true,
            items: {
              include: {
                product: true,
                productVariant: true,
              },
            },
          },
        });

        // If store credit, create a loyalty reward
        if (refundMethod === "STORE_CREDIT" && originalSale.customerId) {
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + 6); // 6 months validity

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

        // Mark original sale with return status (update notes)
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

      res.status(201).json(result);
    } catch (error) {
      console.error("Process return error:", error);
      res.status(500).json({ error: error.message || "Failed to process return" });
    }
  }
);

// Get return history for a specific sale
router.get("/:id/returns", [authenticateToken], async (req, res) => {
  try {
    const { id } = req.params;

    const originalSale = await prisma.sale.findUnique({
      where: { id: parseInt(id) },
      select: { receiptId: true },
    });

    if (!originalSale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    // Find all returns for this sale
    const returns = await prisma.sale.findMany({
      where: {
        notes: {
          contains: `Return for sale ${originalSale.receiptId}`,
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            productVariant: {
              select: { id: true, name: true, sku: true },
            },
          },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const summary = {
      totalReturns: returns.length,
      totalRefunded: returns.reduce((sum, ret) => sum + Math.abs(ret.finalAmount), 0),
      returns: returns,
    };

    res.json(summary);
  } catch (error) {
    console.error("Get returns error:", error);
    res.status(500).json({ error: "Failed to get return history" });
  }
});

// Get all returns (for reports)
router.get(
  "/returns/all",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const skip = (page - 1) * limit;

      const where = {
        receiptId: {
          startsWith: "RET-",
        },
      };

      if (req.query.startDate || req.query.endDate) {
        where.createdAt = {};
        if (req.query.startDate) where.createdAt.gte = new Date(req.query.startDate);
        if (req.query.endDate) where.createdAt.lte = new Date(req.query.endDate);
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

      res.json({
        returns,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get all returns error:", error);
      res.status(500).json({ error: "Failed to get returns" });
    }
  }
);

// Get sales summary for a date range
router.get(
  "/reports/summary",
  [
    authenticateToken,
    query("startDate").optional().isISO8601().withMessage("Start date must be valid ISO date"),
    query("endDate").optional().isISO8601().withMessage("End date must be valid ISO date"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setHours(0, 0, 0, 0));
      const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date(new Date().setHours(23, 59, 59, 999));

      const summary = await prisma.sale.aggregate({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          finalAmount: { gt: 0 }, // Exclude returns
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

      res.json({
        period: {
          startDate,
          endDate,
        },
        summary: {
          totalSales: summary._sum.finalAmount || 0,
          totalTransactions: summary._count,
          totalTax: summary._sum.taxAmount || 0,
          totalDiscounts: summary._sum.discountAmount || 0,
          averageTransaction: summary._count > 0 ? (summary._sum.finalAmount || 0) / summary._count : 0,
        },
        paymentMethodBreakdown,
      });
    } catch (error) {
      console.error("Sales summary error:", error);
      res.status(500).json({ error: "Failed to generate sales summary" });
    }
  }
);

module.exports = router;
