import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as productVariantsController from "./productVariantsController.js";
import {
  createVariantValidator,
  deleteVariantValidator,
  productIdParamValidator,
  updateVariantValidator,
} from "./productVariantsValidator.js";

const router = express.Router();

router
  .route("/")
  .get(authenticateToken, productVariantsController.getAllVariants)
  .post(
    [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...createVariantValidator],
    productVariantsController.createVariant
  );

router
  .route("/:id")
  .get(authenticateToken, productVariantsController.getVariantById)
  .put(
    [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...updateVariantValidator],
    productVariantsController.updateVariant
  )
  .delete(
    [authenticateToken, authorizeRoles("OWNER", "ADMIN"), ...deleteVariantValidator],
    productVariantsController.deleteVariant
  );

router.get(
  "/product/:productId",
  [authenticateToken, ...productIdParamValidator],
  productVariantsController.getVariantsByProduct
);

router.get("/lookup/:identifier", authenticateToken, productVariantsController.lookupVariant);

export const ProductVariantRoutes = router;
