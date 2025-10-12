import express from "express";
import { body } from "express-validator";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "./categoriesController.js";

const router = express.Router();

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

export const CategoryRoutes = router;