import { body, query } from "express-validator";

export const getSalesValidator = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  query("startDate").optional().isISO8601().withMessage("Start date must be valid ISO date"),
  query("endDate").optional().isISO8601().withMessage("End date must be valid ISO date"),
  query("employeeId").optional().isInt().withMessage("Employee ID must be an integer"),
  query("customerId").optional().isInt().withMessage("Customer ID must be an integer"),
  query("paymentMethod").optional().isString().withMessage("Payment method must be a string"),
];

export const createSaleValidator = [
  body("items").isArray({ min: 1 }).withMessage("Items array is required and must have at least one item"),
  body("items.*.productId").isInt().withMessage("Product ID is required for each item"),
  body("items.*.quantity").isFloat({ min: 0.001 }).withMessage("Quantity must be greater than 0"),
  body("items.*.price").optional().isFloat({ min: 0 }).withMessage("Price must be non-negative"),
  body("items.*.discount").optional().isFloat({ min: 0 }).withMessage("Discount must be non-negative"),
  body("customerId").optional().isInt().withMessage("Customer ID must be an integer"),
  body("paymentMethod")
    .isIn(["CASH", "CARD", "MOBILE_PAYMENT", "STORE_CREDIT", "MIXED"])
    .withMessage("Invalid payment method"),
  body("cashReceived").optional().isFloat({ min: 0 }).withMessage("Cash received must be non-negative"),
  body("discountAmount").optional().isFloat({ min: 0 }).withMessage("Discount amount must be non-negative"),
  body("discountReason").optional().isString().withMessage("Discount reason must be a string"),
  body("paymentSplits").optional().isArray().withMessage("Payment splits must be an array"),
  body("paymentSplits.*.paymentMethod")
    .optional()
    .isIn(["CASH", "CARD", "MOBILE_PAYMENT", "STORE_CREDIT"])
    .withMessage("Invalid split payment method"),
  body("paymentSplits.*.amount").optional().isFloat({ min: 0.01 }).withMessage("Split amount must be > 0"),
  body("notes").optional().isString().withMessage("Notes must be a string"),
];

export const processReturnValidator = [
  body("items").isArray({ min: 1 }).withMessage("Items array is required"),
  body("items.*.saleItemId").isInt().withMessage("Sale item ID is required"),
  body("items.*.quantity").isFloat({ min: 0.001 }).withMessage("Return quantity must be greater than 0"),
  body("items.*.condition").optional().isIn(["NEW", "OPENED", "DAMAGED", "DEFECTIVE"]).withMessage("Invalid condition"),
  body("reason").isString().notEmpty().withMessage("Return reason is required"),
  body("refundMethod")
    .isIn(["CASH", "ORIGINAL_PAYMENT", "STORE_CREDIT", "EXCHANGE"])
    .withMessage("Invalid refund method"),
  body("restockingFee").optional().isFloat({ min: 0 }).withMessage("Restocking fee must be a positive number"),
  body("exchangeProductId").optional().isInt().withMessage("Exchange product ID must be an integer"),
];

export const getSalesSummaryValidator = [
  query("startDate").optional().isISO8601().withMessage("Start date must be valid ISO date"),
  query("endDate").optional().isISO8601().withMessage("End date must be valid ISO date"),
];

export const voidSaleValidator = [
  body("reason").notEmpty().withMessage("Void reason is required"),
  body("password").optional().isString(),
];
