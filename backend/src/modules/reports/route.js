import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as reportsController from "./reportsController.js";
import {
  dailySalesValidator,
  employeePerformanceValidator,
  productPerformanceValidator,
  profitMarginValidator,
  salesRangeValidator,
  salesTrendsValidator,
} from "./reportsValidator.js";

const router = express.Router();

router.get(
  "/daily-sales",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...dailySalesValidator],
  reportsController.getDailySales
);

router.get(
  "/sales-range",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...salesRangeValidator],
  reportsController.getSalesRange
);

router.get("/inventory", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], reportsController.getInventory);

router.get(
  "/employee-performance",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...employeePerformanceValidator],
  reportsController.getEmployeePerformance
);

router.get(
  "/product-performance",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...productPerformanceValidator],
  reportsController.getProductPerformance
);

router.get(
  "/profit-margin",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...profitMarginValidator],
  reportsController.getProfitMargin
);

router.get(
  "/stock-turnover",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER")],
  reportsController.getStockTurnover
);

router.get(
  "/sales-trends",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...salesTrendsValidator],
  reportsController.getSalesTrends
);

router.get(
  "/customer-analytics",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER")],
  reportsController.getCustomerAnalytics
);

export const ReportRoutes = router;
