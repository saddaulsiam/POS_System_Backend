import { validationResult } from "express-validator";
import {
  checkAndCreateAlerts,
  createProductService,
  deleteProductImageService,
  deleteProductService,
  exportProductsCSVService,
  exportProductsExcelService,
  getProductBarcodeService,
  getProductByIdService,
  getProductsService,
  importProductsCSVService,
  importProductsExcelService,
  regenerateProductBarcodeService,
  updateProductService,
  uploadProductImageService,
} from "../services/productsService.js";

// Modularized product listing
async function listProducts(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search;
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : undefined;
    const isActive =
      req.query.isActive !== undefined ? req.query.isActive === "true" || req.query.isActive === true : undefined;
    const result = await getProductsService({ page, limit, search, categoryId, isActive });
    res.json(result);
  } catch (error) {
    console.error("List products error:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
}

// Modularized product creation
async function createProduct(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const result = await createProductService(req.body, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: error.message || "Failed to create product" });
  }
}

async function updateProduct(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const product = await updateProductService(id, req.body);
    await checkAndCreateAlerts(product.id);
    res.json(product);
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: error.message || "Failed to update product" });
  }
}

// Delete product (soft delete)
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    await deleteProductService(id);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: error.message || "Failed to delete product" });
  }
}

// Get product by ID
async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const product = await getProductByIdService(id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch product" });
  }
}

// Upload product image
async function uploadProductImage(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    const updatedProduct = await uploadProductImageService(id, req.file);
    res.json(updatedProduct);
  } catch (error) {
    console.error("Upload image error:", error);
    res.status(500).json({ error: error.message || "Failed to upload image" });
  }
}

// Delete product image
async function deleteProductImage(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { id } = req.params;
    const updatedProduct = await deleteProductImageService(id);
    res.json(updatedProduct);
  } catch (error) {
    console.error("Delete image error:", error);
    res.status(500).json({ error: error.message || "Failed to delete image" });
  }
}

//Export products to CSV
async function exportProductsCSV(req, res) {
  try {
    const csv = await exportProductsCSVService();
    res.header("Content-Type", "text/csv");
    res.attachment("products.csv");
    res.send(csv);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: error.message || "Failed to export products" });
  }
}

// Import products from CSV
async function importProductsCSV(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    await importProductsCSVService(req.file.buffer);
    res.json({ success: true });
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: error.message || "Failed to import products" });
  }
}

// Export products to Excel
async function exportProductsExcel(req, res) {
  try {
    const buffer = await exportProductsExcelService();
    res.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.attachment("products.xlsx");
    res.send(buffer);
  } catch (error) {
    console.error("Export Excel error:", error);
    res.status(500).json({ error: error.message || "Failed to export products to Excel" });
  }
}

// Import products from Excel
async function importProductsExcel(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    await importProductsExcelService(req.file.buffer);
    res.json({ success: true });
  } catch (error) {
    console.error("Excel import error:", error);
    res.status(500).json({ error: error.message || "Failed to import Excel file" });
  }
}

// Generate barcode image for a product
async function getProductBarcode(req, res) {
  try {
    const { id } = req.params;
    const result = await getProductBarcodeService(id);
    res.header("Content-Type", "image/png");
    res.send(result.image);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to generate barcode" });
  }
}

// Regenerate barcode for a product
async function regenerateProductBarcode(req, res) {
  try {
    const { id } = req.params;
    const result = await regenerateProductBarcodeService(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to regenerate barcode" });
  }
}

export default {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  uploadProductImage,
  deleteProductImage,
  exportProductsCSV,
  importProductsCSV,
  exportProductsExcel,
  importProductsExcel,
  getProductBarcode,
  regenerateProductBarcode,
};
