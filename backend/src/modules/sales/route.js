import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as salesController from "./salesController.js";
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

router
  .route("/")
  .get(getSalesValidator, salesController.getSales)
  .post(createSaleValidator, salesController.createSale);

router.get("/:identifier", salesController.getSaleById);
router.post(
  "/:id/return",
  [authorizeRoles("ADMIN", "MANAGER"), ...processReturnValidator],
  salesController.processReturn
);
router.get("/:id/returns", salesController.getReturnHistory);
router.post("/:id/void", [authorizeRoles("ADMIN", "MANAGER"), ...voidSaleValidator], salesController.voidSale);
router.get("/returns/all", [authorizeRoles("ADMIN", "MANAGER")], salesController.getAllReturns);
router.get("/reports/summary", getSalesSummaryValidator, salesController.getSalesSummary);

export const SalesRoutes = router;
