const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Get all products with pagination and filtering
router.get(
  "/",
  [
    authenticateToken,
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 2000 }).withMessage("Limit must be between 1 and 2000"),
    query("search").optional().isString().withMessage("Search must be a string"),
    query("categoryId").optional().isInt().withMessage("Category ID must be an integer"),
    query("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const search = req.query.search;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : undefined;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;

      const skip = (page - 1) * limit;

      const where = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { barcode: { contains: search, mode: "insensitive" } },
        ];
      }

      if (categoryId) where.categoryId = categoryId;
      if (isActive !== undefined) where.isActive = isActive;

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: true,
            supplier: true,
          },
          orderBy: { name: "asc" },
          skip,
          take: limit,
        }),
        prisma.product.count({ where }),
      ]);

      res.json({
        data: products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  }
);

// Get product by ID, SKU, or barcode
router.get("/lookup/:identifier", authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;

    const product = await prisma.product.findFirst({
      where: {
        OR: [{ id: isNaN(identifier) ? -1 : parseInt(identifier) }, { sku: identifier }, { barcode: identifier }],
        isActive: true,
      },
      include: {
        category: true,
        supplier: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("Product lookup error:", error);
    res.status(500).json({ error: "Failed to lookup product" });
  }
});

// Create new product
router.post(
  "/",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("name").notEmpty().withMessage("Product name is required"),
    body("sku").notEmpty().withMessage("SKU is required"),
    body("categoryId").isInt().withMessage("Category ID is required"),
    body("purchasePrice").isFloat({ min: 0 }).withMessage("Purchase price must be a positive number"),
    body("sellingPrice").isFloat({ min: 0 }).withMessage("Selling price must be a positive number"),
    body("stockQuantity").optional().isFloat({ min: 0 }).withMessage("Stock quantity must be non-negative"),
    body("lowStockThreshold").optional().isInt({ min: 0 }).withMessage("Low stock threshold must be non-negative"),
    body("isWeighted").optional().isBoolean().withMessage("isWeighted must be a boolean"),
    body("taxRate").optional().isFloat({ min: 0, max: 100 }).withMessage("Tax rate must be between 0 and 100"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if SKU or barcode already exists
      const existing = await prisma.product.findFirst({
        where: {
          OR: [{ sku: req.body.sku }, ...(req.body.barcode ? [{ barcode: req.body.barcode }] : [])],
        },
      });

      if (existing) {
        return res.status(400).json({
          error: "Product with this SKU or barcode already exists",
        });
      }

      const product = await prisma.product.create({
        data: {
          ...req.body,
          stockQuantity: req.body.stockQuantity || 0,
          lowStockThreshold: req.body.lowStockThreshold || 10,
          isWeighted: req.body.isWeighted || false,
          taxRate: req.body.taxRate || 0,
        },
        include: {
          category: true,
          supplier: true,
        },
      });

      // Create stock movement record
      if (req.body.stockQuantity > 0) {
        await prisma.stockMovement.create({
          data: {
            productId: product.id,
            movementType: "ADJUSTMENT",
            quantity: req.body.stockQuantity,
            reason: "Initial stock",
            createdBy: req.user.id,
          },
        });
      }

      res.status(201).json(product);
    } catch (error) {
      console.error("Create product error:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  }
);

// Update product
router.put(
  "/:id",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("name").optional().notEmpty().withMessage("Product name cannot be empty"),
    body("purchasePrice").optional().isFloat({ min: 0 }).withMessage("Purchase price must be positive"),
    body("sellingPrice").optional().isFloat({ min: 0 }).withMessage("Selling price must be positive"),
    body("lowStockThreshold").optional().isInt({ min: 0 }).withMessage("Low stock threshold must be non-negative"),
    body("taxRate").optional().isFloat({ min: 0, max: 100 }).withMessage("Tax rate must be between 0 and 100"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const productId = parseInt(id);

      const existingProduct = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Check for SKU/barcode conflicts if they're being updated
      if (req.body.sku || req.body.barcode) {
        const conflicts = await prisma.product.findFirst({
          where: {
            AND: [
              { id: { not: productId } },
              {
                OR: [
                  ...(req.body.sku ? [{ sku: req.body.sku }] : []),
                  ...(req.body.barcode ? [{ barcode: req.body.barcode }] : []),
                ],
              },
            ],
          },
        });

        if (conflicts) {
          return res.status(400).json({
            error: "Another product with this SKU or barcode already exists",
          });
        }
      }

      const product = await prisma.product.update({
        where: { id: productId },
        data: req.body,
        include: {
          category: true,
          supplier: true,
        },
      });

      // Log audit event for product update
      const { logAudit } = require("../utils/helpers");
      logAudit({
        userId: req.user.id,
        action: "UPDATE_PRODUCT",
        entity: "Product",
        entityId: productId,
        details: JSON.stringify(req.body),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || "",
      });

      res.json(product);
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  }
);

// Delete product (soft delete)
router.delete("/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    // Log audit event for product delete
    const { logAudit } = require("../utils/helpers");
    logAudit({
      userId: req.user.id,
      action: "DELETE_PRODUCT",
      entity: "Product",
      entityId: productId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Get low stock products
router.get("/alerts/low-stock", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    // First get all products, then filter in JavaScript for now
    const allProducts = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        category: true,
        supplier: true,
      },
    });

    // Filter products where stockQuantity <= lowStockThreshold
    const lowStockProducts = allProducts.filter((product) => product.stockQuantity <= product.lowStockThreshold);

    // Sort by stock quantity
    lowStockProducts.sort((a, b) => a.stockQuantity - b.stockQuantity);

    res.json(lowStockProducts);
  } catch (error) {
    console.error("Low stock error:", error);
    res.status(500).json({ error: "Failed to fetch low stock products" });
  }
});

module.exports = router;
