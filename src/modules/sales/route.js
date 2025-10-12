import express from "express";
import * as salesController from "./salesController.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import {
  createSaleValidator,
  getSalesSummaryValidator,
  getSalesValidator,
  processReturnValidator,
  voidSaleValidator,
} from "./salesValidator.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

router.get("/", getSalesValidator, salesController.getSales);
router.get("/:identifier", salesController.getSaleById);
router.post("/", createSaleValidator, salesController.createSale);
router.post(
  "/:id/return",
  [authorizeRoles("ADMIN", "MANAGER"), ...processReturnValidator],
  salesController.processReturn
);
router.get("/:id/returns", salesController.getReturnHistory);
router.get("/returns/all", [authorizeRoles("ADMIN", "MANAGER")], salesController.getAllReturns);
router.get("/reports/summary", getSalesSummaryValidator, salesController.getSalesSummary);
router.post("/:id/void", [authorizeRoles("ADMIN", "MANAGER"), ...voidSaleValidator], salesController.voidSale);

export default router;
