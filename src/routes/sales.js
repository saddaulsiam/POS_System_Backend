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
    body("notes").optional().isString().withMessage("Notes must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { items, customerId, paymentMethod, cashReceived, discountAmount = 0, notes } = req.body;
      const employeeId = req.user.id;

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

        // Create sale
        const sale = await tx.sale.create({
          data: {
            receiptId,
            employeeId,
            customerId,
            subtotal,
            taxAmount: totalTax,
            discountAmount,
            finalAmount,
            paymentMethod,
            cashReceived,
            changeGiven: paymentMethod === "CASH" ? (cashReceived || 0) - finalAmount : 0,
            notes,
            saleItems: {
              create: saleItemsData,
            },
          },
          include: {
            employee: { select: { id: true, name: true, username: true } },
            customer: { select: { id: true, name: true, phoneNumber: true } },
            saleItems: {
              include: {
                product: { select: { id: true, name: true, sku: true, isWeighted: true } },
              },
            },
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

// Process return/refund
router.post(
  "/:id/return",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("items").isArray({ min: 1 }).withMessage("Items array is required"),
    body("items.*.saleItemId").isInt().withMessage("Sale item ID is required"),
    body("items.*.quantity").isFloat({ min: 0.001 }).withMessage("Return quantity must be greater than 0"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { items, reason } = req.body;
      const saleId = parseInt(id);

      const result = await prisma.$transaction(async (tx) => {
        // Get original sale
        const originalSale = await tx.sale.findUnique({
          where: { id: saleId },
          include: { saleItems: true },
        });

        if (!originalSale) {
          throw new Error("Original sale not found");
        }

        let refundAmount = 0;
        const returnItems = [];

        // Process each return item
        for (const returnItem of items) {
          const originalSaleItem = originalSale.saleItems.find((item) => item.id === returnItem.saleItemId);

          if (!originalSaleItem) {
            throw new Error(`Sale item ${returnItem.saleItemId} not found in original sale`);
          }

          if (returnItem.quantity > originalSaleItem.quantity) {
            throw new Error(`Cannot return more than originally purchased`);
          }

          const itemRefundAmount =
            originalSaleItem.priceAtSale * returnItem.quantity -
            originalSaleItem.discount * (returnItem.quantity / originalSaleItem.quantity);

          refundAmount += itemRefundAmount;

          returnItems.push({
            productId: originalSaleItem.productId,
            quantity: returnItem.quantity,
            priceAtSale: originalSaleItem.priceAtSale,
            discount: originalSaleItem.discount * (returnItem.quantity / originalSaleItem.quantity),
            subtotal: -itemRefundAmount,
          });

          // Return stock
          await tx.product.update({
            where: { id: originalSaleItem.productId },
            data: { stockQuantity: { increment: returnItem.quantity } },
          });

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId: originalSaleItem.productId,
              movementType: "RETURN",
              quantity: returnItem.quantity,
              reason: `Return from sale ${originalSale.receiptId}: ${reason || "No reason provided"}`,
              reference: originalSale.receiptId,
              createdBy: req.user.id,
            },
          });
        }

        // Create return sale (negative amounts)
        const returnSale = await tx.sale.create({
          data: {
            receiptId: `RET-${generateReceiptId()}`,
            employeeId: req.user.id,
            customerId: originalSale.customerId,
            subtotal: -refundAmount,
            taxAmount: 0,
            discountAmount: 0,
            finalAmount: -refundAmount,
            paymentMethod: "CASH", // Assuming cash refund
            paymentStatus: "COMPLETED",
            notes: `Return for sale ${originalSale.receiptId}. Reason: ${reason || "No reason provided"}`,
            saleItems: {
              create: returnItems,
            },
          },
          include: {
            employee: { select: { id: true, name: true } },
            customer: { select: { id: true, name: true } },
            saleItems: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
        });

        return returnSale;
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Process return error:", error);
      res.status(500).json({ error: error.message || "Failed to process return" });
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
