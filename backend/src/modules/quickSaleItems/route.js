import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as quickSaleItemsController from "./quickSaleItemsController.js";
import {
  createQuickSaleItemValidator,
  deleteQuickSaleItemValidator,
  updateQuickSaleItemValidator,
} from "./quickSaleItemsValidator.js";

const router = express.Router();

router
  .route("/")
  .get(authenticateToken, quickSaleItemsController.getAllQuickSaleItems)
  .post(
    [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...createQuickSaleItemValidator],
    quickSaleItemsController.createQuickSaleItem
  );

router
  .route("/:id")
  .put(
    [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...updateQuickSaleItemValidator],
    quickSaleItemsController.updateQuickSaleItem
  )
  .delete(
    [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...deleteQuickSaleItemValidator],
    quickSaleItemsController.deleteQuickSaleItem
  );

export const QuickSaleItemsRoutes = router;
