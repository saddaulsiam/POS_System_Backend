import express from "express";
import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  updateSupplier,
} from "./suppliersController.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/suppliers
router.get("/", authorizeRoles("ADMIN", "MANAGER"), getSuppliers);

// GET /api/suppliers/:id
router.get("/:id", authorizeRoles("ADMIN", "MANAGER"), getSupplierById);

// POST /api/suppliers
router.post("/", authorizeRoles("ADMIN", "MANAGER"), createSupplier);

// PUT /api/suppliers/:id
router.put("/:id", authorizeRoles("ADMIN", "MANAGER"), updateSupplier);

// DELETE /api/suppliers/:id
router.delete("/:id", authorizeRoles("ADMIN"), deleteSupplier);

export default router;
