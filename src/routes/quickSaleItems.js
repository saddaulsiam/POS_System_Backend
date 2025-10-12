import express from "express";
import * as quickSaleItemsController from "../controllers/quickSaleItemsController.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import {
  createQuickSaleItemValidator,
  deleteQuickSaleItemValidator,
  updateQuickSaleItemValidator,
} from "../validators/quickSaleItemsValidator.js";

const router = express.Router();

router.get("/", authenticateToken, quickSaleItemsController.getAllQuickSaleItems);

router.post(
  "/",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...createQuickSaleItemValidator],
  quickSaleItemsController.createQuickSaleItem
);

router.put(
  "/:id",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...updateQuickSaleItemValidator],
  quickSaleItemsController.updateQuickSaleItem
);

router.delete(
  "/:id",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...deleteQuickSaleItemValidator],
  quickSaleItemsController.deleteQuickSaleItem
);

export default router;
