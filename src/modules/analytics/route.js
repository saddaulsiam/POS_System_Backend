import express from "express";
import * as analyticsController from "./analyticsController.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import analyticsValidator from "./analyticsValidator.js";

const router = express.Router();
router.get(
  "/overview",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...analyticsValidator.overview],
  analyticsController.overview
);

router.get(
  "/sales-trend",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...analyticsValidator.salesTrend],
  analyticsController.salesTrend
);

router.get(
  "/top-products",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...analyticsValidator.topProducts],
  analyticsController.topProducts
);

router.get(
  "/category-breakdown",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...analyticsValidator.categoryBreakdown],
  analyticsController.categoryBreakdown
);

router.get(
  "/customer-stats",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...analyticsValidator.customerStats],
  analyticsController.customerStats
);

router.get(
  "/payment-methods",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...analyticsValidator.paymentMethods],
  analyticsController.paymentMethods
);

export const AnalyticsRoutes = router;
