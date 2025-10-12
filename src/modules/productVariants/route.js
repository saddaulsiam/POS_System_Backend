import express from "express";
import productVariantsController from "./productVariantsController.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import {
  createVariantValidator,
  deleteVariantValidator,
  productIdParamValidator,
  updateVariantValidator,
} from "./productVariantsValidator.js";

const router = express.Router();

router.get("/", authenticateToken, productVariantsController.getAllVariants);

router.get(
  "/product/:productId",
  [authenticateToken, ...productIdParamValidator],
  productVariantsController.getVariantsByProduct
);

router.post(
  "/",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...createVariantValidator],
  productVariantsController.createVariant
);

router.put(
  "/:id",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...updateVariantValidator],
  productVariantsController.updateVariant
);

router.delete(
  "/:id",
  [authenticateToken, authorizeRoles("ADMIN"), ...deleteVariantValidator],
  productVariantsController.deleteVariant
);

router.get("/lookup/:identifier", authenticateToken, productVariantsController.lookupVariant);

export default router;
