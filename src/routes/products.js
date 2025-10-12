const express = require("express");
import { validationResult } from "express-validator";
import productsValidator from "../validators/productsValidator.js";
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { upload } = require("../utils/upload");
const multer = require("multer");
const router = express.Router();
const csvUpload = multer({ storage: multer.memoryStorage() });
const productsController = require("../controllers/productsController");

// Get all products with pagination and filtering
router.get("/", [authenticateToken, ...productsValidator.list], productsController.listProducts);

router.post(
  "/",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...productsValidator.create],
  productsController.createProduct
);

router.put(
  "/:id",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...productsValidator.update],
  productsController.updateProduct
);

// Delete product
router.delete("/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], productsController.deleteProduct);

// Upload product image
router.post(
  "/:id/image",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  upload.single("image"),
  productsController.uploadProductImage
);

// Delete product image
router.delete(
  "/:id/image",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  productsController.deleteProductImage
);

// Export products as CSV
router.get("/export", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], productsController.exportProductsCSV);

// Import products from CSV
router.post(
  "/import",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), csvUpload.single("file")],
  productsController.importProductsCSV
);

// Export products as Excel
router.get(
  "/export/excel",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER")],
  productsController.exportProductsExcel
);

// Import products from Excel
router.post(
  "/import/excel",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), csvUpload.single("file")],
  productsController.importProductsExcel
);

// Get product barcode
router.get("/:id/barcode", productsController.getProductBarcode);

// Regenerate product barcode
router.post(
  "/:id/barcode/regenerate",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER")],
  productsController.regenerateProductBarcode
);

// Get product by ID
router.get("/:id", authenticateToken, productsController.getProductById);

module.exports = router;
