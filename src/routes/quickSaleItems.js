const express = require("express");
const { body, param, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Get all quick sale items
router.get("/", [authenticateToken], async (req, res) => {
  try {
    const quickSaleItems = await prisma.quickSaleItem.findMany({
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    res.json(quickSaleItems);
  } catch (error) {
    console.error("Get quick sale items error:", error);
    res.status(500).json({ error: "Failed to fetch quick sale items" });
  }
});

// Create a quick sale item
router.post(
  "/",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("productId").isInt().withMessage("Product ID is required"),
    body("displayName").notEmpty().withMessage("Display name is required"),
    body("color")
      .optional()
      .matches(/^#[0-9A-F]{6}$/i)
      .withMessage("Color must be a valid hex color"),
    body("sortOrder").optional().isInt({ min: 0 }),
    body("isActive").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, displayName, color, sortOrder, isActive } = req.body;

      // Check if product exists
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Check if quick sale item already exists for this product
      const existing = await prisma.quickSaleItem.findFirst({
        where: { productId },
      });

      if (existing) {
        return res.status(400).json({ error: "Quick sale item already exists for this product" });
      }

      const quickSaleItem = await prisma.quickSaleItem.create({
        data: {
          productId,
          displayName,
          color: color || "#3B82F6",
          sortOrder: sortOrder || 0,
          isActive: isActive !== undefined ? isActive : true,
        },
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      });

      res.status(201).json(quickSaleItem);
    } catch (error) {
      console.error("Create quick sale item error:", error);
      res.status(500).json({ error: "Failed to create quick sale item" });
    }
  }
);

// Update a quick sale item
router.put(
  "/:id",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    param("id").isInt().withMessage("ID must be an integer"),
    body("displayName").optional().notEmpty(),
    body("color")
      .optional()
      .matches(/^#[0-9A-F]{6}$/i),
    body("sortOrder").optional().isInt({ min: 0 }),
    body("isActive").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const id = parseInt(req.params.id);
      const { displayName, color, sortOrder, isActive } = req.body;

      // Check if exists
      const existing = await prisma.quickSaleItem.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: "Quick sale item not found" });
      }

      const updateData = {};
      if (displayName !== undefined) updateData.displayName = displayName;
      if (color !== undefined) updateData.color = color;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (isActive !== undefined) updateData.isActive = isActive;

      const quickSaleItem = await prisma.quickSaleItem.update({
        where: { id },
        data: updateData,
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      });

      res.json(quickSaleItem);
    } catch (error) {
      console.error("Update quick sale item error:", error);
      res.status(500).json({ error: "Failed to update quick sale item" });
    }
  }
);

// Delete a quick sale item
router.delete(
  "/:id",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), param("id").isInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const id = parseInt(req.params.id);

      await prisma.quickSaleItem.delete({
        where: { id },
      });

      res.json({ message: "Quick sale item deleted successfully" });
    } catch (error) {
      console.error("Delete quick sale item error:", error);
      res.status(500).json({ error: "Failed to delete quick sale item" });
    }
  }
);

module.exports = router;
