import { body, param, query } from "express-validator";

export const getCustomerIdParam = [param("customerId").isInt().withMessage("Customer ID must be an integer")];
export const getOfferIdParam = [param("offerId").isInt().withMessage("Offer ID must be an integer")];

export const redeemValidator = [
  body("customerId").isInt().withMessage("Customer ID is required"),
  body("pointsCost").isInt({ min: 1 }).withMessage("Points cost must be positive"),
  body("rewardType")
    .isIn(["DISCOUNT_PERCENTAGE", "DISCOUNT_FIXED", "FREE_PRODUCT", "POINTS_MULTIPLIER"])
    .withMessage("Invalid reward type"),
  body("rewardValue").isFloat({ min: 0 }).withMessage("Reward value is required"),
  body("description").notEmpty().withMessage("Description is required"),
];

export const redeemPointsValidator = [
  body("customerId").isInt().withMessage("Customer ID is required"),
  body("points").isInt({ min: 1 }).withMessage("Points must be positive"),
  body("rewardType")
    .isIn(["DISCOUNT", "FREE_PRODUCT", "STORE_CREDIT", "SPECIAL_OFFER"])
    .withMessage("Invalid reward type"),
  body("rewardValue").isNumeric().withMessage("Reward value is required"),
  body("description").optional().isString(),
];

export const awardPointsValidator = [
  body("customerId").isInt().withMessage("Customer ID is required"),
  body("saleId").isInt().withMessage("Sale ID is required"),
  body("amount").isFloat({ min: 0 }).withMessage("Amount must be positive"),
];

export const createOfferValidator = [
  body("title").notEmpty().withMessage("Title is required"),
  body("description").notEmpty().withMessage("Description is required"),
  body("offerType")
    .isIn(["DISCOUNT_PERCENTAGE", "DISCOUNT_FIXED", "BUY_X_GET_Y", "POINTS_MULTIPLIER"])
    .withMessage("Invalid offer type"),
  body("discountValue").optional().isFloat({ min: 0 }),
  body("minimumPurchase").optional().isFloat({ min: 0 }),
  body("requiredTier").optional().isIn(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
  body("startDate").isISO8601().withMessage("Valid start date required"),
  body("endDate").isISO8601().withMessage("Valid end date required"),
];

export const updateOfferValidator = [
  body("title").optional().notEmpty(),
  body("description").optional().notEmpty(),
  body("offerType").optional().isIn(["DISCOUNT_PERCENTAGE", "DISCOUNT_FIXED", "BUY_X_GET_Y", "POINTS_MULTIPLIER"]),
  body("discountValue").optional().isFloat({ min: 0 }),
  body("minimumPurchase").optional().isFloat({ min: 0 }),
  body("requiredTier").optional().isIn(["BRONZE", "SILVER", "GOLD", "PLATINUM"]),
  body("startDate").optional().isISO8601(),
  body("endDate").optional().isISO8601(),
  body("isActive").optional().isBoolean(),
];

export const updateTierValidator = [
  body("tier").isIn(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).withMessage("Invalid tier"),
];

export const loyaltyTierConfigValidator = [
  body("tier").isIn(["BRONZE", "SILVER", "GOLD", "PLATINUM"]).withMessage("Invalid tier"),
  body("minimumPoints").isInt({ min: 0 }).withMessage("Minimum points must be non-negative"),
  body("pointsMultiplier").isFloat({ min: 1.0 }).withMessage("Points multiplier must be at least 1.0"),
  body("discountPercentage").isFloat({ min: 0, max: 100 }).withMessage("Discount percentage must be between 0 and 100"),
  body("birthdayBonus").isInt({ min: 0 }).withMessage("Birthday bonus must be non-negative"),
  body("description").optional().isString(),
];
