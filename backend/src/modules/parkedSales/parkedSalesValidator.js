import { body, param } from "express-validator";

export const parkSaleValidator = [
  body("items").isArray({ min: 1 }).withMessage("Items array is required and must have at least one item"),
  body("subtotal").isFloat({ min: 0 }).withMessage("Subtotal must be >= 0"),
  body("taxAmount").optional().isFloat({ min: 0 }),
  body("discountAmount").optional().isFloat({ min: 0 }),
  body("customerId").optional().isInt(),
  body("notes").optional().isString(),
  body("expiresAt").optional().isISO8601(),
];

export const parkedSaleIdParam = [param("id").isInt()];
