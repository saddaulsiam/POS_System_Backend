import { body, query } from "express-validator";

const productsValidator = {
  list: [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 2000 }).withMessage("Limit must be between 1 and 2000"),
    query("search").optional().isString().withMessage("Search must be a string"),
    query("categoryId").optional().isInt().withMessage("Category ID must be an integer"),
    query("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  ],
  create: [
    body("name").notEmpty().withMessage("Product name is required"),
    body("sku").notEmpty().withMessage("SKU is required"),
    body("categoryId").isInt().withMessage("Category ID is required"),
    body("purchasePrice").isFloat({ min: 0 }).withMessage("Purchase price must be a positive number"),
    body("sellingPrice").isFloat({ min: 0 }).withMessage("Selling price must be a positive number"),
    body("stockQuantity").optional().isFloat({ min: 0 }).withMessage("Stock quantity must be non-negative"),
    body("lowStockThreshold").optional().isInt({ min: 0 }).withMessage("Low stock threshold must be non-negative"),
    body("isWeighted").optional().isBoolean().withMessage("isWeighted must be a boolean"),
    body("taxRate").optional().isFloat({ min: 0, max: 100 }).withMessage("Tax rate must be between 0 and 100"),
  ],
  update: [
    body("name").optional().notEmpty().withMessage("Product name cannot be empty"),
    body("purchasePrice").optional().isFloat({ min: 0 }).withMessage("Purchase price must be positive"),
    body("sellingPrice").optional().isFloat({ min: 0 }).withMessage("Selling price must be positive"),
    body("lowStockThreshold").optional().isInt({ min: 0 }).withMessage("Low stock threshold must be non-negative"),
    body("taxRate").optional().isFloat({ min: 0, max: 100 }).withMessage("Tax rate must be between 0 and 100"),
  ],
};

export default productsValidator;
