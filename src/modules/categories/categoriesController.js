import {
  fetchCategories,
  fetchCategoryById,
  createCategoryService,
  findCategoryByName,
  findCategoryById,
  findNameConflict,
  updateCategoryService,
  deleteCategoryService,
} from "./categoriesService.js";

import { sendError } from "../../utils/response.js";
import { sendSuccess } from "../../utils/response.js";

// Get all categories
async function getCategories(req, res) {
  try {
    const categories = await fetchCategories();
  sendSuccess(res, categories);
  } catch (error) {
    console.error("Get categories error:", error);
    sendError(res, 500, "Failed to fetch categories");
  }
}

// Get category by ID
async function getCategoryById(req, res) {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);
    const category = await fetchCategoryById(categoryId);
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
    const errors = req.validationResult ? req.validationResult() : [];
    if (errors && errors.length > 0) {
      return sendError(res, 400, errors);
    }
    const { name } = req.body;
    const existing = await findCategoryByName(name);
    if (existing) {
      return sendError(res, 400, "Category with this name already exists");
    }
    const category = await createCategoryService(name);
  sendSuccess(res, category, 201);
  } catch (error) {
    console.error("Create category error:", error);
    sendError(res, 500, "Failed to create category");
  }
}

// Update category
async function updateCategory(req, res) {
  try {
    const errors = req.validationResult ? req.validationResult() : [];
    if (errors && errors.length > 0) {
      return sendError(res, 400, errors);
    }
    const { id } = req.params;
    const { name } = req.body;
    const categoryId = parseInt(id);
    const existingCategory = await findCategoryById(categoryId);
    if (!existingCategory) {
      return sendError(res, 404, "Category not found");
    }
    const nameConflict = await findNameConflict(name, categoryId);
    if (nameConflict) {
      return sendError(res, 400, "Another category with this name already exists");
    }
    const category = await updateCategoryService(categoryId, name);
  sendSuccess(res, category);
  } catch (error) {
    console.error("Update category error:", error);
    sendError(res, 500, "Failed to update category");
  }
}

// Delete category
async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);
    const category = await fetchCategoryById(categoryId);
    if (!category) {
      return sendError(res, 404, "Category not found");
    }
    if (category._count.products > 0) {
      return sendError(res, 400, "Cannot delete category that has products. Please reassign products first.");
    }
    await deleteCategoryService(categoryId);
  sendSuccess(res, { message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    sendError(res, 500, "Failed to delete category");
  }
}

export { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
