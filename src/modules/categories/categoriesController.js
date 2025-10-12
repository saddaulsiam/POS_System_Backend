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

// Get all categories
async function getCategories(req, res) {
  try {
    const categories = await fetchCategories();
    res.json(categories);
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
}

// Get category by ID
async function getCategoryById(req, res) {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);
    const category = await fetchCategoryById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({ error: "Failed to fetch category" });
  }
}

// Create new category
async function createCategory(req, res) {
  try {
    const errors = req.validationResult ? req.validationResult() : [];
    if (errors && errors.length > 0) {
      return res.status(400).json({ errors });
    }
    const { name } = req.body;
    const existing = await findCategoryByName(name);
    if (existing) {
      return res.status(400).json({ error: "Category with this name already exists" });
    }
    const category = await createCategoryService(name);
    res.status(201).json(category);
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ error: "Failed to create category" });
  }
}

// Update category
async function updateCategory(req, res) {
  try {
    const errors = req.validationResult ? req.validationResult() : [];
    if (errors && errors.length > 0) {
      return res.status(400).json({ errors });
    }
    const { id } = req.params;
    const { name } = req.body;
    const categoryId = parseInt(id);
    const existingCategory = await findCategoryById(categoryId);
    if (!existingCategory) {
      return res.status(404).json({ error: "Category not found" });
    }
    const nameConflict = await findNameConflict(name, categoryId);
    if (nameConflict) {
      return res.status(400).json({ error: "Another category with this name already exists" });
    }
    const category = await updateCategoryService(categoryId, name);
    res.json(category);
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({ error: "Failed to update category" });
  }
}

// Delete category
async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const categoryId = parseInt(id);
    const category = await fetchCategoryById(categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    if (category._count.products > 0) {
      return res.status(400).json({
        error: "Cannot delete category that has products. Please reassign products first.",
      });
    }
    await deleteCategoryService(categoryId);
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ error: "Failed to delete category" });
  }
}

export { getCategories, getCategoryById, createCategory, updateCategory, deleteCategory };
