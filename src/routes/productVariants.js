const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Get all product variants
router.get("/", authenticateToken, async (req, res) => {
  try {
    const variants = await prisma.productVariant.findMany({
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });

    res.json(variants);
  } catch (error) {
    console.error("Get all variants error:", error);
    res.status(500).json({ error: "Failed to fetch variants" });
  }
});

// Get all variants for a product
router.get(
  "/product/:productId",
  [authenticateToken, param("productId").isInt().withMessage("Product ID must be an integer")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const productId = parseInt(req.params.productId);

      const variants = await prisma.productVariant.findMany({
        where: { productId },
        orderBy: { name: "asc" },
      });

      res.json(variants);
    } catch (error) {
      console.error("Get variants error:", error);
      res.status(500).json({ error: "Failed to fetch variants" });
    }
  }
);

// Create a new variant
router.post(
  "/",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("productId").isInt().withMessage("Product ID is required"),
    body("name").notEmpty().withMessage("Variant name is required"),
    body("sku").notEmpty().withMessage("SKU is required"),
    body("barcode").optional().isString(),
    body("purchasePrice").isFloat({ min: 0 }).withMessage("Purchase price must be a positive number"),
    body("sellingPrice").isFloat({ min: 0 }).withMessage("Selling price must be a positive number"),
    body("stockQuantity").optional().isFloat({ min: 0 }),
    body("isActive").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, name, sku, barcode, purchasePrice, sellingPrice, stockQuantity, isActive } = req.body;

      // Check if product exists
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Check for duplicate SKU
      const existingSKU = await prisma.productVariant.findUnique({
        where: { sku },
      });

      if (existingSKU) {
        return res.status(400).json({ error: "SKU already exists" });
      }

      // Check for duplicate barcode if provided
      if (barcode) {
        const existingBarcode = await prisma.productVariant.findFirst({
          where: { barcode },
        });

        if (existingBarcode) {
          return res.status(400).json({ error: "Barcode already exists" });
        }
      }

      const variant = await prisma.productVariant.create({
        data: {
          productId,
          name,
          sku,
          barcode,
          purchasePrice,
          sellingPrice,
          stockQuantity: stockQuantity || 0,
          isActive: isActive !== undefined ? isActive : true,
        },
      });

      // Update parent product hasVariants flag
      await prisma.product.update({
        where: { id: productId },
        data: { hasVariants: true },
      });

      res.status(201).json(variant);
    } catch (error) {
      console.error("Create variant error:", error);
      res.status(500).json({ error: "Failed to create variant" });
    }
  }
);

// Update a variant
router.put(
  "/:id",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    param("id").isInt().withMessage("Variant ID must be an integer"),
    body("name").optional().notEmpty(),
    body("sku").optional().notEmpty(),
    body("barcode").optional().isString(),
    body("purchasePrice").optional().isFloat({ min: 0 }),
    body("sellingPrice").optional().isFloat({ min: 0 }),
    body("stockQuantity").optional().isFloat({ min: 0 }),
    body("isActive").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const id = parseInt(req.params.id);
      const { name, sku, barcode, purchasePrice, sellingPrice, stockQuantity, isActive } = req.body;

      // Check if variant exists
      const existingVariant = await prisma.productVariant.findUnique({
        where: { id },
      });

      if (!existingVariant) {
        return res.status(404).json({ error: "Variant not found" });
      }

      // Check for duplicate SKU if updating
      if (sku && sku !== existingVariant.sku) {
        const duplicateSKU = await prisma.productVariant.findUnique({
          where: { sku },
        });

        if (duplicateSKU) {
          return res.status(400).json({ error: "SKU already exists" });
        }
      }

      // Check for duplicate barcode if updating
      if (barcode && barcode !== existingVariant.barcode) {
        const duplicateBarcode = await prisma.productVariant.findFirst({
          where: { barcode },
        });

        if (duplicateBarcode) {
          return res.status(400).json({ error: "Barcode already exists" });
        }
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (sku !== undefined) updateData.sku = sku;
      if (barcode !== undefined) updateData.barcode = barcode;
      if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice;
      if (sellingPrice !== undefined) updateData.sellingPrice = sellingPrice;
      if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity;
      if (isActive !== undefined) updateData.isActive = isActive;

      const variant = await prisma.productVariant.update({
        where: { id },
        data: updateData,
      });

      res.json(variant);
    } catch (error) {
      console.error("Update variant error:", error);
      res.status(500).json({ error: "Failed to update variant" });
    }
  }
);

// Delete a variant
router.delete(
  "/:id",
  [authenticateToken, authorizeRoles("ADMIN"), param("id").isInt().withMessage("Variant ID must be an integer")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const id = parseInt(req.params.id);

      const variant = await prisma.productVariant.findUnique({
        where: { id },
        include: { product: true },
      });

      if (!variant) {
        return res.status(404).json({ error: "Variant not found" });
      }

      await prisma.productVariant.delete({
        where: { id },
      });

      // Check if product still has variants
      const remainingVariants = await prisma.productVariant.count({
        where: { productId: variant.productId },
      });

      if (remainingVariants === 0) {
        await prisma.product.update({
          where: { id: variant.productId },
          data: { hasVariants: false },
        });
      }

      res.json({ message: "Variant deleted successfully" });
    } catch (error) {
      console.error("Delete variant error:", error);
      res.status(500).json({ error: "Failed to delete variant" });
    }
  }
);

// Lookup variant by SKU or barcode
router.get("/lookup/:identifier", authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;

    const variant = await prisma.productVariant.findFirst({
      where: {
        OR: [{ id: isNaN(identifier) ? -1 : parseInt(identifier) }, { sku: identifier }, { barcode: identifier }],
        isActive: true,
      },
      include: {
        product: {
          include: {
            category: true,
            supplier: true,
          },
        },
      },
    });

    if (!variant) {
      return res.status(404).json({ error: "Variant not found" });
    }

    res.json(variant);
  } catch (error) {
    console.error("Lookup variant error:", error);
    res.status(500).json({ error: "Failed to lookup variant" });
  }
});

module.exports = router;
