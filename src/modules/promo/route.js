import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as promoController from "./promoController.js";

const router = express.Router();

// Merchant & Guest validation route
router.post("/validate", promoController.validatePromoCode);

// Merchant only route to apply trial extension promo codes
router.post("/apply-trial-promo", authenticateToken, promoController.applyTrialPromo);

// Super Admin restricted routes
router.use(authenticateToken);
router.use(authorizeRoles("SUPER_ADMIN"));

router.get("/", promoController.getPromoCodes);
router.post("/", promoController.createPromoCode);
router.put("/:id/toggle", promoController.togglePromoCodeStatus);
router.delete("/:id", promoController.deletePromoCode);

export default router;
