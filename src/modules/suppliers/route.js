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
  .get(authorizeRoles("OWNER", "ADMIN", "MANAGER"), getSuppliers)
  .post(authorizeRoles("OWNER", "ADMIN", "MANAGER"), createSupplier);

router
  .route("/:id")
  .get(authorizeRoles("OWNER", "ADMIN", "MANAGER"), getSupplierById)
  .put(authorizeRoles("OWNER", "ADMIN", "MANAGER"), updateSupplier)
  .delete(authorizeRoles("OWNER", "ADMIN"), deleteSupplier);

export const SuppliersRoutes = router;
