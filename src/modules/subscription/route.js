import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as subscriptionController from "./subscriptionController.js";

const router = express.Router();

// Get subscription status (all roles)
router.get("/status", authenticateToken, subscriptionController.getSubscriptionStatus);

// Activate subscription after payment (OWNER only)
router.post("/activate", authenticateToken, authorizeRoles("OWNER"), subscriptionController.activateSubscription);

// Renew subscription (OWNER only)
router.post("/renew", authenticateToken, authorizeRoles("OWNER"), subscriptionController.renewSubscription);

// Mark warning as shown
router.post("/warning-shown", authenticateToken, subscriptionController.markWarningShown);

// Cancel subscription (OWNER only)
router.post("/cancel", authenticateToken, authorizeRoles("OWNER"), subscriptionController.cancelSubscription);

export const SubscriptionRoutes = router;
