import express from "express";
import * as loyaltyController from "./loyaltyController.js";
import { authenticateToken, authorizeRoles, optionalAuth } from "../../middleware/auth.js";
import {
  awardPointsValidator,
  createOfferValidator,
  getCustomerIdParam,
  getOfferIdParam,
  loyaltyTierConfigValidator,
  redeemPointsValidator,
  redeemValidator,
  updateOfferValidator,
  updateTierValidator,
} from "./loyaltyValidator.js";

const router = express.Router();

router.get("/tiers", loyaltyController.getTiers);

// Get customer's points history
router.get(
  "/customers/:customerId/points-history",
  [authenticateToken, ...getCustomerIdParam],
  loyaltyController.getPointsHistory
);

// Redeem points for reward
router.post("/redeem", [authenticateToken, ...redeemValidator], loyaltyController.redeem);

// Redeem points (simplified endpoint for POS)
router.post("/redeem-points", [authenticateToken, ...redeemPointsValidator], loyaltyController.redeemPoints);

// Get customer's active rewards
router.get("/customers/:customerId/rewards", [authenticateToken, ...getCustomerIdParam], loyaltyController.getRewards);

// Award points for sale (called after sale creation)
router.post("/award-points", [authenticateToken, ...awardPointsValidator], loyaltyController.awardPoints);

// Check birthday rewards (should be called daily via cron)
router.post("/birthday-rewards", authenticateToken, authorizeRoles("ADMIN"), loyaltyController.birthdayRewards);

// Get loyalty offers (Public - shows only active offers; Admin sees all)
router.get("/offers", [optionalAuth], loyaltyController.getOffers);

// Create loyalty offer (Admin/Manager)
router.post(
  "/offers",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  ...createOfferValidator,
  loyaltyController.createOffer
);

// Update customer tier manually (Admin only)
router.put(
  "/customers/:customerId/tier",
  authenticateToken,
  authorizeRoles("ADMIN"),
  ...getCustomerIdParam,
  ...updateTierValidator,
  loyaltyController.updateTier
);

// Get customer's complete loyalty status
router.get(
  "/customers/:customerId/loyalty-status",
  [authenticateToken, ...getCustomerIdParam],
  loyaltyController.getLoyaltyStatus
);

// Update loyalty offer (Admin/Manager)
router.put(
  "/offers/:offerId",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  ...getOfferIdParam,
  ...updateOfferValidator,
  loyaltyController.updateOffer
);

// Delete loyalty offer (Admin only)
router.delete(
  "/offers/:offerId",
  authenticateToken,
  authorizeRoles("ADMIN"),
  ...getOfferIdParam,
  loyaltyController.deleteOffer
);

// Manage loyalty tier configuration (Admin only)
router.post(
  "/tiers/config",
  authenticateToken,
  authorizeRoles("ADMIN"),
  ...loyaltyTierConfigValidator,
  loyaltyController.loyaltyTierConfig
);

// Get loyalty program statistics (Admin/Manager only)
router.get("/statistics", authenticateToken, authorizeRoles("ADMIN", "MANAGER"), loyaltyController.getStatistics);

export default router;
