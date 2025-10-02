const express = require("express");
const { body, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Get all categories
router.get("/", authenticateToken, async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Get category by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { name: "asc" },
        },
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(category);
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
});

// Create new category
router.post(
  "/",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("name").notEmpty().trim().withMessage("Category name is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name } = req.body;

      // Check if category name already exists
      const existing = await prisma.category.findUnique({
        where: { name: name.trim() },
      });

      if (existing) {
        return res.status(400).json({ error: "Category with this name already exists" });
      }

      const category = await prisma.category.create({
        data: { name: name.trim() },
        include: {
          _count: {
            select: { products: true },
          },
        },
      });

      res.status(201).json(category);
    } catch (error) {
      console.error("Create category error:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  }
);

// Update category
router.put(
  "/:id",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("name").notEmpty().trim().withMessage("Category name is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { name } = req.body;
      const categoryId = parseInt(id);

      const existingCategory = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!existingCategory) {
        return res.status(404).json({ error: "Category not found" });
      }

      // Check if another category with this name exists
      const nameConflict = await prisma.category.findFirst({
        where: {
          name: name.trim(),
          id: { not: categoryId },
        },
      });

      if (nameConflict) {
        return res.status(400).json({ error: "Another category with this name already exists" });
      }

      const category = await prisma.category.update({
        where: { id: categoryId },
        data: { name: name.trim() },
        include: {
          _count: {
            select: { products: true },
          },
        },
      });

      res.json(category);
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  }
);

// Delete category
router.delete("/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    if (category._count.products > 0) {
      return res.status(400).json({
        error: "Cannot delete category that has products. Please reassign products first.",
      });
    }

    await prisma.category.delete({
      where: { id: categoryId },
    });

    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

module.exports = router;
