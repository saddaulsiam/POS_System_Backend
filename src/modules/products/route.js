import express from "express";
import multer from "multer";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import { uploadMemory } from "../../utils/upload.js";
import {
  createProduct,
  deleteProduct,
  deleteProductImage,
  exportProductsCSV,
  exportProductsExcel,
  getProductBarcode,
  getProductById,
  importProductsCSV,
  importProductsExcel,
  listProducts,
  regenerateProductBarcode,
  updateProduct,
  uploadProductImage,
} from "./productsController.js";
import productsValidator from "./productsValidator.js";

const router = express.Router();
const csvUpload = multer({ storage: multer.memoryStorage() });

router
  .route("/")
  .get([authenticateToken, ...productsValidator.list], listProducts)
  .post([authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...productsValidator.create], createProduct);

router
  .route("/:id")
  .get(authenticateToken, getProductById)
  .put([authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...productsValidator.update], updateProduct)
  .delete([authenticateToken, authorizeRoles("ADMIN", "MANAGER")], deleteProduct);

router
  .route("/:id/image")
  .post(authenticateToken, authorizeRoles("ADMIN", "MANAGER"), uploadMemory.single("image"), uploadProductImage)
  .delete(authenticateToken, authorizeRoles("ADMIN", "MANAGER"), deleteProductImage);

// Regenerate product barcode
router.post(
  "/:id/barcode/regenerate",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER")],
  regenerateProductBarcode
);

// Get product barcode
router.get("/:id/barcode", getProductBarcode);

// Export products as CSV
router.get("/export", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], exportProductsCSV);

// Import products from CSV
router.post(
  "/import",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), csvUpload.single("file")],
  importProductsCSV
);

// Export products as Excel
router.get("/export/excel", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], exportProductsExcel);

// Import products from Excel
router.post(
  "/import/excel",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), csvUpload.single("file")],
  importProductsExcel
);

export const ProductRoutes = router;
