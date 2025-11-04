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
      return sendError(res, 400, errors.array());
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
    sendError(res, 500, "Failed to fetch products");
  }
}

// Modularized product creation
async function createProduct(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const result = await createProductService(req.body, req.user.id);
    await checkAndCreateAlerts(result.id);
    sendSuccess(res, result, 201);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to create product");
  }
}

async function updateProduct(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const { id } = req.params;
    const product = await updateProductService(id, req.body);
    await checkAndCreateAlerts(product.id);
    sendSuccess(res, product);
  } catch (error) {
    console.error("Update product error:", error);
    sendError(res, 500, error.message || "Failed to update product");
  }
}

// Delete product (soft delete)
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    await deleteProductService(id);
    sendSuccess(res, { message: "Product deleted successfully" });
  } catch (error) {
    sendError(res, 500, error.message || "Failed to delete product");
  }
}

// Get product by ID
async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const product = await getProductByIdService(id);
    if (!product) return sendError(res, 404, "Product not found");
    sendSuccess(res, product);
  } catch (error) {
    console.error("Get product error:", error);
    sendError(res, 500, error.message || "Failed to fetch product");
  }
}

// Upload product image
async function uploadProductImage(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const { id } = req.params;
    if (!req.file) return sendError(res, 400, "No image uploaded");
    const updatedProduct = await uploadProductImageService(id, req.file);
    await checkAndCreateAlerts(updatedProduct.id);
    sendSuccess(res, updatedProduct);
  } catch (error) {
    console.error("Upload image error:", error);
    sendError(res, 500, error.message || "Failed to upload image");
  }
}

// Delete product image
async function deleteProductImage(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const { id } = req.params;
    const updatedProduct = await deleteProductImageService(id);
    sendSuccess(res, updatedProduct);
  } catch (error) {
    console.error("Delete image error:", error);
    sendError(res, 500, error.message || "Failed to delete image");
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
    sendError(res, 500, error.message || "Failed to export products");
  }
}

// Import products from CSV
async function importProductsCSV(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    if (!req.file) return sendError(res, 400, "No file uploaded");
    await importProductsCSVService(req.file.buffer);
    sendSuccess(res, { success: true });
  } catch (error) {
    console.error("Import error:", error);
    sendError(res, 500, error.message || "Failed to import products");
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
    sendError(res, 500, error.message || "Failed to export products to Excel");
  }
}

// Import products from Excel
async function importProductsExcel(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    if (!req.file) return sendError(res, 400, "No file uploaded");
    await importProductsExcelService(req.file.buffer);
    sendSuccess(res, { success: true });
  } catch (error) {
    console.error("Excel import error:", error);
    sendError(res, 500, error.message || "Failed to import Excel file");
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
    sendError(res, 500, error.message || "Failed to generate barcode");
  }
}

// Regenerate barcode for a product
async function regenerateProductBarcode(req, res) {
  try {
    const { id } = req.params;
    const result = await regenerateProductBarcodeService(id);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to regenerate barcode");
  }
}

async function getProductNotifications(req, res) {
  try {
    const notifications = await getNotificationsService();
    sendSuccess(res, notifications);
  } catch (error) {
    console.error("Get product notifications error:", error);
    sendError(res, 500, error.message || "Failed to fetch product notifications");
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
