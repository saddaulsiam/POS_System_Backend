import { validationResult } from "express-validator";
import { sendError, sendSuccess } from "../../utils/response.js";
import {
  createCategoryService,
  deleteCategoryService,
  fetchCategories,
  fetchCategoryById,
  findCategoryById,
  findCategoryByName,
  findNameConflict,
  updateCategoryService,
  uploadCategoryIconService,
} from "./categoriesService.js";

// Get all categories
async function getCategories(req, res) {
  try {
    const storeId = req.user.storeId;
    const categories = await fetchCategories(storeId);
    sendSuccess(res, categories);
  } catch (error) {
    console.error("Get categories error:", error);
    sendError(res, 500, "Failed to fetch categories");
  }
}

// Get category by ID
async function getCategoryById(req, res) {
  try {
    const storeId = req.user.storeId;
    const { id } = req.params;
    const categoryId = parseInt(id);
    const category = await fetchCategoryById(categoryId, storeId);
    if (!category) {
      return sendError(res, 404, "Category not found");
    }
    sendSuccess(res, category);
  } catch (error) {
    console.error("Get category error:", error);
    sendError(res, 500, "Failed to fetch category");
  }
}

// Create new category
async function createCategory(req, res) {
  try {
    const storeId = req.user.storeId;
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }

    const { name } = req.body;

    const existing = await findCategoryByName(name.trim(), storeId);
    if (existing) {
      return sendError(res, 400, "Category with this name already exists");
    }

    // Create category with icon if file is uploaded
    const category = await createCategoryService(name.trim(), req.file, storeId);
    sendSuccess(res, category, 201);
  } catch (error) {
    console.error("Create category error:", error);
    sendError(res, 500, "Failed to create category");
  }
}

// Update category
async function updateCategory(req, res) {
  try {
    const storeId = req.user.storeId;
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array()[0].msg);
    }

    const { id } = req.params;
    const { name } = req.body;
    const categoryId = parseInt(id);

    const existingCategory = await findCategoryById(categoryId, storeId);
    if (!existingCategory) {
      return sendError(res, 404, "Category not found");
    }

    const nameConflict = await findNameConflict(name.trim(), categoryId, storeId);
    if (nameConflict) {
      return sendError(res, 400, "Another category with this name already exists");
    }

    // Update category with icon if file is uploaded
    const category = await updateCategoryService(categoryId, name.trim(), req.file, storeId);
    sendSuccess(res, category);
  } catch (error) {
    console.error("Update category error:", error);
    sendError(res, 500, "Failed to update category");
  }
}

// Delete category
async function deleteCategory(req, res) {
  try {
    const storeId = req.user.storeId;
    const { id } = req.params;
    const categoryId = parseInt(id);
    const category = await fetchCategoryById(categoryId, storeId);
    if (!category) {
      return sendError(res, 404, "Category not found");
    }
    if (category._count.products > 0) {
      return sendError(res, 400, "Cannot delete category that has products. Please reassign products first.");
    }
    await deleteCategoryService(categoryId, storeId);
    sendSuccess(res, { message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    sendError(res, 500, "Failed to delete category");
  }
}

// Upload category icon
async function uploadCategoryIcon(req, res) {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);

    if (!req.file) {
      return sendError(res, 400, "No image file provided");
    }

    const category = await uploadCategoryIconService(categoryId, req.file);
    sendSuccess(res, category);
  } catch (error) {
    console.error("Upload category icon error:", error);
    if (error.message === "Category not found") {
      return sendError(res, 404, error.message);
    }
    sendError(res, 500, error.message || "Failed to upload icon");
  }
}

export { createCategory, deleteCategory, getCategories, getCategoryById, updateCategory, uploadCategoryIcon };
