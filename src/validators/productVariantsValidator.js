import { body, param } from "express-validator";

export const createVariantValidator = [
  body("productId").isInt().withMessage("Product ID is required"),
  body("name").notEmpty().withMessage("Variant name is required"),
  body("sku").notEmpty().withMessage("SKU is required"),
  body("barcode").optional().isString(),
  body("purchasePrice").isFloat({ min: 0 }).withMessage("Purchase price must be a positive number"),
  body("sellingPrice").isFloat({ min: 0 }).withMessage("Selling price must be a positive number"),
  body("stockQuantity").optional().isFloat({ min: 0 }),
  body("isActive").optional().isBoolean(),
];

export const updateVariantValidator = [
  param("id").isInt().withMessage("Variant ID must be an integer"),
  body("name").optional().notEmpty(),
  body("sku").optional().notEmpty(),
  body("barcode").optional().isString(),
  body("purchasePrice").optional().isFloat({ min: 0 }),
  body("sellingPrice").optional().isFloat({ min: 0 }),
  body("stockQuantity").optional().isFloat({ min: 0 }),
  body("isActive").optional().isBoolean(),
];

export const productIdParamValidator = [param("productId").isInt().withMessage("Product ID must be an integer")];

export const deleteVariantValidator = [param("id").isInt().withMessage("Variant ID must be an integer")];
