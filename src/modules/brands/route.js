import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import { uploadMemory } from "../../utils/upload.js";
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
} from "./brandsController.js";
import brandValidator from "./brandValidator.js";

const router = express.Router();

router
  .route("/")
  .get(authenticateToken, getBrands)
  .post(
    [
      authenticateToken,
      authorizeRoles("OWNER", "ADMIN", "MANAGER"),
      uploadMemory.single("icon"),
      ...brandValidator.create,
    ],
    createBrand
  );

router
  .route("/:id")
  .get(authenticateToken, getBrandById)
  .put(
    [
      authenticateToken,
      authorizeRoles("OWNER", "ADMIN", "MANAGER"),
      uploadMemory.single("icon"),
      ...brandValidator.update,
    ],
    updateBrand
  )
  .delete([authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER")], deleteBrand);

export default router;
