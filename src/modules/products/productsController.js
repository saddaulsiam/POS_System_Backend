import { validationResult } from "express-validator";
import { sendError, sendSuccess } from "../../utils/response.js";
import { checkAndCreateAlerts, getNotificationsService } from "../notifications/notificationService.js";
import {
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
} from "./productsService.js";

// Modularized product listing
async function listProducts(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search;
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : undefined;
    const isActive =
      req.query.isActive !== undefined ? req.query.isActive === "true" || req.query.isActive === true : undefined;
    const showDeleted = req.query.showDeleted === "true" || req.query.showDeleted === true;
    const result = await getProductsService({ page, limit, search, categoryId, isActive, showDeleted });
    sendSuccess(res, result);
  } catch (error) {
    console.error("List products error:", error);
    sendError(res, "Failed to fetch products", 500);
  }
}

// Modularized product creation
async function createProduct(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    const result = await createProductService(req.body, req.user.id);
    await checkAndCreateAlerts(result.id);
    sendSuccess(res, result, 201);
  } catch (error) {
    sendError(res, error.message || "Failed to create product", 500);
  }
}

async function updateProduct(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    const { id } = req.params;
    const product = await updateProductService(id, req.body);
    await checkAndCreateAlerts(product.id);
    sendSuccess(res, product);
  } catch (error) {
    console.error("Update product error:", error);
    sendError(res, error.message || "Failed to update product", 500);
  }
}

// Delete product (soft delete)
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    await deleteProductService(id);
    sendSuccess(res, { message: "Product deleted successfully" });
  } catch (error) {
    sendError(res, error.message || "Failed to delete product", 500);
  }
}

// Get product by ID
async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const product = await getProductByIdService(id);
    if (!product) return sendError(res, "Product not found", 404);
    sendSuccess(res, product);
  } catch (error) {
    console.error("Get product error:", error);
    sendError(res, error.message || "Failed to fetch product", 500);
  }
}

// Upload product image
async function uploadProductImage(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    const { id } = req.params;
    if (!req.file) return sendError(res, "No image uploaded", 400);
    const updatedProduct = await uploadProductImageService(id, req.file);
    await checkAndCreateAlerts(updatedProduct.id);
    sendSuccess(res, updatedProduct);
  } catch (error) {
    console.error("Upload image error:", error);
    sendError(res, error.message || "Failed to upload image", 500);
  }
}

// Delete product image
async function deleteProductImage(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    const { id } = req.params;
    const updatedProduct = await deleteProductImageService(id);
    sendSuccess(res, updatedProduct);
  } catch (error) {
    console.error("Delete image error:", error);
    sendError(res, error.message || "Failed to delete image", 500);
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
    sendError(res, error.message || "Failed to export products", 500);
  }
}

// Import products from CSV
async function importProductsCSV(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    if (!req.file) return sendError(res, "No file uploaded", 400);
    await importProductsCSVService(req.file.buffer);
    sendSuccess(res, { success: true });
  } catch (error) {
    console.error("Import error:", error);
    sendError(res, error.message || "Failed to import products", 500);
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
    sendError(res, error.message || "Failed to export products to Excel", 500);
  }
}

// Import products from Excel
async function importProductsExcel(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array(), 400);
    }
    if (!req.file) return sendError(res, "No file uploaded", 400);
    await importProductsExcelService(req.file.buffer);
    sendSuccess(res, { success: true });
  } catch (error) {
    console.error("Excel import error:", error);
    sendError(res, error.message || "Failed to import Excel file", 500);
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
    sendError(res, error.message || "Failed to generate barcode", 500);
  }
}

// Regenerate barcode for a product
async function regenerateProductBarcode(req, res) {
  try {
    const { id } = req.params;
    const result = await regenerateProductBarcodeService(id);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, error.message || "Failed to regenerate barcode", 500);
  }
}

async function getProductNotifications(req, res) {
  try {
    const notifications = await getNotificationsService();
    res.json(notifications);
  } catch (error) {
    console.error("Get product notifications error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch product notifications" });
  }
}

export {
  createProduct,
  deleteProduct,
  deleteProductImage,
  exportProductsCSV,
  exportProductsExcel,
  getProductBarcode,
  getProductById,
  getProductNotifications,
  importProductsCSV,
  importProductsExcel,
  listProducts,
  regenerateProductBarcode,
  updateProduct,
  uploadProductImage,
};
