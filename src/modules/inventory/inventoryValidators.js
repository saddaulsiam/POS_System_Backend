import { body, query } from "express-validator";

export const inventoryValidators = {
  getStockMovements: [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("productId").optional().isInt().withMessage("Product ID must be an integer"),
    query("movementType").optional().isString().withMessage("Movement type must be a string"),
    query("startDate").optional().isISO8601().withMessage("Start date must be valid ISO date"),
    query("endDate").optional().isISO8601().withMessage("End date must be valid ISO date"),
  ],
  createStockAdjustment: [
    body("productId").isInt().withMessage("Product ID is required"),
    body("quantity").isFloat().withMessage("Quantity is required"),
    body("movementType")
      .isString()
      .isIn(["PURCHASE", "ADJUSTMENT", "RETURN", "DAMAGED", "EXPIRED"])
      .withMessage("Invalid movement type"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  bulkStockUpdate: [
    body("updates").isArray({ min: 1 }).withMessage("Updates array is required"),
    body("updates.*.productId").isInt().withMessage("Product ID is required for each update"),
    body("updates.*.newQuantity").isFloat({ min: 0 }).withMessage("New quantity must be non-negative"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  stockTransfer: [
    body("productId").isInt().withMessage("Product ID is required"),
    body("productVariantId").optional().isInt(),
    body("quantity").isFloat({ min: 0.01 }).withMessage("Quantity must be positive"),
    body("fromLocation").notEmpty().withMessage("From location is required"),
    body("toLocation").notEmpty().withMessage("To location is required"),
    body("notes").optional().isString(),
  ],
  getStockAlerts: [query("isResolved").optional().isBoolean()],
  receivePurchaseOrder: [
    body("purchaseOrderId").isInt().withMessage("Purchase order ID is required"),
    body("items").isArray({ min: 1 }).withMessage("Items array required"),
    body("items.*.productId").isInt(),
    body("items.*.receivedQuantity").isFloat({ min: 0 }),
  ],
  createPurchaseOrder: [
    body("supplierId").isInt().withMessage("Supplier ID is required"),
    body("orderDate").isISO8601().withMessage("Order date must be valid"),
    body("expectedDate").optional().isISO8601().withMessage("Expected date must be valid"),
    body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
    body("items.*.productId").isInt().withMessage("Product ID is required"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("items.*.unitPrice").isFloat({ min: 0 }).withMessage("Unit price must be valid"),
  ],
  updatePurchaseOrder: [
    body("supplierId").optional().isInt().withMessage("Supplier ID must be valid"),
    body("orderDate").optional().isISO8601().withMessage("Order date must be valid"),
    body("expectedDate").optional().isISO8601().withMessage("Expected date must be valid"),
    body("items").optional().isArray().withMessage("Items must be an array"),
    body("items.*.productId").optional().isInt().withMessage("Product ID is required"),
    body("items.*.quantity").optional().isFloat({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("items.*.unitPrice").optional().isFloat({ min: 0 }).withMessage("Unit price must be valid"),
  ],
  receivePurchaseOrderItems: [
    body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
    body("items.*.itemId").isInt().withMessage("Item ID is required"),
    body("items.*.receivedQuantity").isFloat({ min: 0 }).withMessage("Received quantity must be valid"),
  ],
};
