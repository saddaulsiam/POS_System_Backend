import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as adminController from "./adminController.js";

const router = express.Router();

// Public platform settings (unauthenticated)
router.get("/settings/public", adminController.getPublicSettings);

// Apply super-admin authentication globally to this router
router.use(authenticateToken);
router.use(authorizeRoles("SUPER_ADMIN"));

// Settings routes
router.get("/settings", adminController.getSystemSettings);
router.put("/settings", adminController.updateSystemSettings);

// Get system overview statistics
router.get("/stats", adminController.getAdminStats);

// Store directory routes
router.get("/stores", adminController.getStores);
router.put("/stores/:id/status", adminController.toggleStoreStatus);
router.put("/stores/:id/reset-pin", adminController.resetStoreOwnerPin);
router.put("/stores/:id/subscription", adminController.updateStoreSubscription);
router.post("/stores/:id/impersonate", adminController.impersonateStore);
router.delete("/stores/:id", adminController.deleteStore);

// Subscriptions & billing routes
router.get("/subscriptions", adminController.getSubscriptions);
router.post("/subscriptions/:id/extend", adminController.extendSubscription);
router.get("/payments", adminController.getPayments);

export const AdminRoutes = router;
