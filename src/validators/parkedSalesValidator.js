import { body, param } from "express-validator";

export const parkSaleValidator = [
  body("items").isArray().withMessage("Items must be an array"),
  body("subtotal").isFloat({ min: 0 }).withMessage("Subtotal must be >= 0"),
  body("taxAmount").optional().isFloat({ min: 0 }),
  body("discountAmount").optional().isFloat({ min: 0 }),
  body("customerId").optional().isInt(),
  body("notes").optional().isString(),
  body("expiresAt").optional().isISO8601(),
];

export const parkedSaleIdParam = [param("id").isInt()];
