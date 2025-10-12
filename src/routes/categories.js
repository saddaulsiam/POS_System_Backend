import { PrismaClient } from "@prisma/client";
import express from "express";
import { body } from "express-validator";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();
const prisma = new PrismaClient();

import categoriesController from "../controllers/categoriesController.js";
const { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory } = categoriesController;

// Get all categories
router.get("/", authenticateToken, getCategories);

// Get category by ID
router.get("/:id", authenticateToken, getCategoryById);

// Create new category
router.post(
  "/",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("name").notEmpty().trim().withMessage("Category name is required"),
  ],
  createCategory
);

// Update category
router.put(
  "/:id",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("name").notEmpty().trim().withMessage("Category name is required"),
  ],
  updateCategory
);

// Delete category
router.delete("/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], deleteCategory);

export default router;
