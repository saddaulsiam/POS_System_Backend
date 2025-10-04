const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Get stock movements with filtering
router.get(
  "/movements",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("productId").optional().isInt().withMessage("Product ID must be an integer"),
    query("movementType").optional().isString().withMessage("Movement type must be a string"),
    query("startDate").optional().isISO8601().withMessage("Start date must be valid ISO date"),
    query("endDate").optional().isISO8601().withMessage("End date must be valid ISO date"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const where = {};

      if (req.query.productId) where.productId = parseInt(req.query.productId);
      if (req.query.movementType) where.movementType = req.query.movementType;
      if (req.query.startDate || req.query.endDate) {
        where.createdAt = {};
        if (req.query.startDate) where.createdAt.gte = new Date(req.query.startDate);
        if (req.query.endDate) where.createdAt.lte = new Date(req.query.endDate);
      }

      const [movements, total] = await Promise.all([
        prisma.stockMovement.findMany({
          where,
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.stockMovement.count({ where }),
      ]);

      res.json({
        movements,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get stock movements error:", error);
      res.status(500).json({ error: "Failed to fetch stock movements" });
    }
  }
);

// Create stock adjustment
router.post(
  "/adjust",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("productId").isInt().withMessage("Product ID is required"),
    body("quantity").isFloat().withMessage("Quantity is required"),
    body("movementType")
      .isString()
      .isIn(["PURCHASE", "ADJUSTMENT", "RETURN", "DAMAGED", "EXPIRED"])
      .withMessage("Invalid movement type"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, quantity, movementType, reason } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId },
        });

        if (!product) {
          throw new Error("Product not found");
        }

        // Update stock
        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { stockQuantity: { increment: quantity } },
        });

        // Create stock movement
        const movement = await tx.stockMovement.create({
          data: {
            productId,
            movementType,
            quantity,
            reason: reason || "Manual stock adjustment",
            createdBy: req.user.id,
          },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        });

        return { movement, updatedStock: updatedProduct.stockQuantity };
      });

      res.json(result);
    } catch (error) {
      console.error("Stock adjustment error:", error);
      res.status(500).json({ error: error.message || "Failed to adjust stock" });
    }
  }
);

// Get low stock alert
router.get("/alerts/low-stock", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    // Note: This is a workaround since Prisma doesn't support field comparison directly
    const lowStockProducts = await prisma.$queryRaw`
      SELECT p.*, c.name as categoryName 
      FROM Product p 
      LEFT JOIN Category c ON p.categoryId = c.id 
      WHERE p.isActive = 1 AND p.stockQuantity <= p.lowStockThreshold 
      ORDER BY p.stockQuantity ASC
    `;

    res.json(lowStockProducts);
  } catch (error) {
    console.error("Low stock alert error:", error);
    res.status(500).json({ error: "Failed to fetch low stock alerts" });
  }
});

// Get inventory summary
router.get("/summary", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const [totalProducts, totalValue, lowStockCount] = await Promise.all([
      prisma.product.count({
        where: { isActive: true },
      }),
      prisma.product.aggregate({
        where: { isActive: true },
        _sum: {
          stockQuantity: true,
        },
      }),
      prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM Product 
        WHERE isActive = 1 AND stockQuantity <= lowStockThreshold
      `,
    ]);

    const totalStockValue = await prisma.product.aggregate({
      where: { isActive: true },
      _sum: {
        stockQuantity: true,
      },
    });

    // Calculate total inventory value
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { stockQuantity: true, purchasePrice: true },
    });

    const totalInventoryValue = products.reduce((sum, product) => {
      return sum + product.stockQuantity * product.purchasePrice;
    }, 0);

    res.json({
      totalProducts,
      totalItems: totalValue._sum.stockQuantity || 0,
      totalInventoryValue,
      lowStockProducts: lowStockCount[0]?.count || 0,
    });
  } catch (error) {
    console.error("Inventory summary error:", error);
    res.status(500).json({ error: "Failed to generate inventory summary" });
  }
});

// Bulk stock update (from CSV or manual input)
router.post(
  "/bulk-update",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("updates").isArray({ min: 1 }).withMessage("Updates array is required"),
    body("updates.*.productId").isInt().withMessage("Product ID is required for each update"),
    body("updates.*.newQuantity").isFloat({ min: 0 }).withMessage("New quantity must be non-negative"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { updates, reason } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const results = [];

        for (const update of updates) {
          const product = await tx.product.findUnique({
            where: { id: update.productId },
          });

          if (!product) {
            throw new Error(`Product with ID ${update.productId} not found`);
          }

          const quantityDifference = update.newQuantity - product.stockQuantity;

          // Update stock
          const updatedProduct = await tx.product.update({
            where: { id: update.productId },
            data: { stockQuantity: update.newQuantity },
          });

          // Create stock movement if there's a change
          if (quantityDifference !== 0) {
            await tx.stockMovement.create({
              data: {
                productId: update.productId,
                movementType: "ADJUSTMENT",
                quantity: quantityDifference,
                reason: reason || "Bulk stock update",
                createdBy: req.user.id,
              },
            });
          }

          results.push({
            productId: update.productId,
            productName: product.name,
            oldQuantity: product.stockQuantity,
            newQuantity: update.newQuantity,
            difference: quantityDifference,
          });
        }

        return results;
      });

      res.json({
        message: `Updated stock for ${result.length} products`,
        updates: result,
      });
    } catch (error) {
      console.error("Bulk stock update error:", error);
      res.status(500).json({ error: error.message || "Failed to update stock" });
    }
  }
);

// Stock adjustment (damage, expiry, loss, found)
router.post(
  "/adjust",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("productId").isInt().withMessage("Product ID is required"),
    body("productVariantId").optional().isInt(),
    body("quantity").isFloat().withMessage("Quantity is required"),
    body("reason").isIn(["DAMAGED", "EXPIRED", "LOST", "FOUND", "COUNT_ADJUSTMENT"]).withMessage("Invalid reason"),
    body("notes").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, productVariantId, quantity, reason, notes } = req.body;
      const employeeId = req.user.id;

      const result = await prisma.$transaction(async (tx) => {
        // Update stock
        if (productVariantId) {
          await tx.productVariant.update({
            where: { id: productVariantId },
            data: { stockQuantity: { increment: quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: productId },
            data: { stockQuantity: { increment: quantity } },
          });
        }

        // Create stock movement
        const movement = await tx.stockMovement.create({
          data: {
            productId,
            productVariantId,
            movementType: "ADJUSTMENT",
            quantity,
            reason,
            reference: notes || `Adjustment: ${reason}`,
            createdBy: employeeId,
          },
          include: {
            product: {
              select: { id: true, name: true, sku: true, stockQuantity: true },
            },
            productVariant: {
              select: { id: true, name: true, stockQuantity: true },
            },
          },
        });

        // Create alert if stock is now low
        if (!productVariantId) {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (product.stockQuantity <= product.lowStockThreshold) {
            await tx.stockAlert.create({
              data: {
                productId,
                alertType: product.stockQuantity === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
                message: `${product.name} stock is ${product.stockQuantity === 0 ? "out of stock" : "low"}`,
              },
            });
          }
        }

        return movement;
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Stock adjustment error:", error);
      res.status(500).json({ error: error.message || "Failed to adjust stock" });
    }
  }
);

// Stock transfer between locations
router.post(
  "/transfer",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("productId").isInt().withMessage("Product ID is required"),
    body("productVariantId").optional().isInt(),
    body("quantity").isFloat({ min: 0.01 }).withMessage("Quantity must be positive"),
    body("fromLocation").notEmpty().withMessage("From location is required"),
    body("toLocation").notEmpty().withMessage("To location is required"),
    body("notes").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, productVariantId, quantity, fromLocation, toLocation, notes } = req.body;
      const employeeId = req.user.id;

      // Create transfer reference ID
      const transferId = `TR-${Date.now()}`;

      const result = await prisma.$transaction(async (tx) => {
        // Deduct from source location
        const outMovement = await tx.stockMovement.create({
          data: {
            productId,
            productVariantId,
            movementType: "TRANSFER",
            quantity: -quantity,
            reason: `Transfer to ${toLocation}`,
            reference: transferId,
            fromLocation,
            toLocation,
            createdBy: employeeId,
          },
        });

        // Add to destination location
        const inMovement = await tx.stockMovement.create({
          data: {
            productId,
            productVariantId,
            movementType: "TRANSFER",
            quantity: quantity,
            reason: `Transfer from ${fromLocation}`,
            reference: transferId,
            fromLocation,
            toLocation,
            createdBy: employeeId,
          },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            productVariant: {
              select: { id: true, name: true },
            },
          },
        });

        return {
          transferId,
          outMovement,
          inMovement,
        };
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Stock transfer error:", error);
      res.status(500).json({ error: error.message || "Failed to transfer stock" });
    }
  }
);

// Get stock alerts
router.get(
  "/alerts",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), query("isResolved").optional().isBoolean()],
  async (req, res) => {
    try {
      const where = {};
      if (req.query.isResolved !== undefined) {
        where.isResolved = req.query.isResolved === "true";
      }

      const alerts = await prisma.stockAlert.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              stockQuantity: true,
              lowStockThreshold: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(alerts);
    } catch (error) {
      console.error("Get alerts error:", error);
      res.status(500).json({ error: "Failed to fetch stock alerts" });
    }
  }
);

// Resolve stock alert
router.put("/alerts/:id/resolve", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const employeeId = req.user.id;

    const alert = await prisma.stockAlert.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: employeeId,
      },
      include: {
        product: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(alert);
  } catch (error) {
    console.error("Resolve alert error:", error);
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

// Receive purchase order
router.post(
  "/receive-purchase-order",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("purchaseOrderId").isInt().withMessage("Purchase order ID is required"),
    body("items").isArray({ min: 1 }).withMessage("Items array required"),
    body("items.*.productId").isInt(),
    body("items.*.receivedQuantity").isFloat({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { purchaseOrderId, items } = req.body;
      const employeeId = req.user.id;

      const result = await prisma.$transaction(async (tx) => {
        const po = await tx.purchaseOrder.findUnique({
          where: { id: purchaseOrderId },
          include: { items: true },
        });

        if (!po) {
          throw new Error("Purchase order not found");
        }

        // Update each item
        for (const receivedItem of items) {
          const poItem = po.items.find((i) => i.productId === receivedItem.productId);
          if (!poItem) continue;

          // Update PO item
          await tx.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: {
              receivedQuantity: { increment: receivedItem.receivedQuantity },
            },
          });

          // Update product stock
          await tx.product.update({
            where: { id: receivedItem.productId },
            data: {
              stockQuantity: { increment: receivedItem.receivedQuantity },
            },
          });

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId: receivedItem.productId,
              movementType: "PURCHASE",
              quantity: receivedItem.receivedQuantity,
              reason: "Purchase order received",
              reference: po.poNumber,
              createdBy: employeeId,
            },
          });
        }

        // Check if PO is fully received
        const updatedPO = await tx.purchaseOrder.findUnique({
          where: { id: purchaseOrderId },
          include: { items: true },
        });

        const allReceived = updatedPO.items.every((item) => item.receivedQuantity >= item.quantity);
        const partiallyReceived = updatedPO.items.some((item) => item.receivedQuantity > 0);

        const newStatus = allReceived ? "RECEIVED" : partiallyReceived ? "PARTIALLY_RECEIVED" : "ORDERED";

        // Update PO status
        const finalPO = await tx.purchaseOrder.update({
          where: { id: purchaseOrderId },
          data: {
            status: newStatus,
            receivedDate: allReceived ? new Date() : null,
          },
          include: {
            supplier: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        return finalPO;
      });

      res.json(result);
    } catch (error) {
      console.error("Receive PO error:", error);
      res.status(500).json({ error: error.message || "Failed to receive purchase order" });
    }
  }
);

module.exports = router;
