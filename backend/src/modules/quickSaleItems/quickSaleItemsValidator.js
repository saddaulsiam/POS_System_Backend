import { body, param } from "express-validator";

export const createQuickSaleItemValidator = [
  body("productId").isInt().withMessage("Product ID is required"),
  body("displayName").notEmpty().withMessage("Display name is required"),
  body("color")
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage("Color must be a valid hex color"),
  body("sortOrder").optional().isInt({ min: 0 }),
  body("isActive").optional().isBoolean(),
];

export const updateQuickSaleItemValidator = [
  param("id").isInt().withMessage("ID must be an integer"),
  body("displayName").optional().notEmpty(),
  body("color")
    .optional()
    .matches(/^#[0-9A-F]{6}$/i),
  body("sortOrder").optional().isInt({ min: 0 }),
  body("isActive").optional().isBoolean(),
];

export const deleteQuickSaleItemValidator = [param("id").isInt().withMessage("ID must be an integer")];
