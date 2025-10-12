import express from "express";
import multer from "multer";
import ProductsController from "../controllers/productsController.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { upload } from "../utils/upload.js";
import productsValidator from "../validators/productsValidator.js";

const router = express.Router();
const csvUpload = multer({ storage: multer.memoryStorage() });

// Get all products with pagination and filtering
router.get("/", [authenticateToken, ...productsValidator.list], ProductsController.listProducts);

router.post(
  "/",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...productsValidator.create],
  ProductsController.createProduct
);

router.put(
  "/:id",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...productsValidator.update],
  ProductsController.updateProduct
);

// Delete product
router.delete("/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], ProductsController.deleteProduct);

// Upload product image
router.post(
  "/:id/image",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  upload.single("image"),
  ProductsController.uploadProductImage
);

// Delete product image
router.delete(
  "/:id/image",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  ProductsController.deleteProductImage
);

// Export products as CSV
router.get("/export", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], ProductsController.exportProductsCSV);

// Import products from CSV
router.post(
  "/import",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), csvUpload.single("file")],
  ProductsController.importProductsCSV
);

// Export products as Excel
router.get(
  "/export/excel",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER")],
  ProductsController.exportProductsExcel
);

// Import products from Excel
router.post(
  "/import/excel",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), csvUpload.single("file")],
  ProductsController.importProductsExcel
);

// Get product barcode
router.get("/:id/barcode", ProductsController.getProductBarcode);

// Regenerate product barcode
router.post(
  "/:id/barcode/regenerate",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER")],
  ProductsController.regenerateProductBarcode
);

// Get product by ID
router.get("/:id", authenticateToken, ProductsController.getProductById);

export default router;
