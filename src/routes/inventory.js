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

module.exports = router;
