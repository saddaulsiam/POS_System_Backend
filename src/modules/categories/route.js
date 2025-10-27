import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "./categoriesController.js";
import categoryValidator from "./categoryValidator.js";

const router = express.Router();

router
  .route("/")
  .get(authenticateToken, getCategories)
  .post([authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...categoryValidator.create], createCategory);

router
  .route("/:id")
  .get(authenticateToken, getCategoryById)
  .put([authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...categoryValidator.update], updateCategory)
  .delete([authenticateToken, authorizeRoles("ADMIN", "MANAGER")], deleteCategory);

export const CategoryRoutes = router;
