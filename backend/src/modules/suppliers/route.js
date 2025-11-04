import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import {
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  updateSupplier,
} from "./suppliersController.js";

const router = express.Router();

router.use(authenticateToken);

router
  .route("/")
  .get(authorizeRoles("ADMIN", "MANAGER"), getSuppliers)
  .post(authorizeRoles("ADMIN", "MANAGER"), createSupplier);

router
  .route("/:id")
  .get(authorizeRoles("ADMIN", "MANAGER"), getSupplierById)
  .put(authorizeRoles("ADMIN", "MANAGER"), updateSupplier)
  .delete(authorizeRoles("ADMIN"), deleteSupplier);

export const SuppliersRoutes = router;
