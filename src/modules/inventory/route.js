import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import {
  bulkStockUpdate,
  cancelPurchaseOrder,
  createPurchaseOrder,
  createStockAdjustment,
  getInventorySummary,
  getPurchaseOrderById,
  getPurchaseOrders,
  getPurchaseOrderStats,
  getStockAlerts,
  getStockMovements,
  receivePurchaseOrder,
  receivePurchaseOrderItems,
  resolveStockAlert,
  stockTransfer,
  updatePurchaseOrder,
} from "./inventoryController.js";
import { inventoryValidators } from "./inventoryValidators.js";

const router = express.Router();

// Get stock movements with filtering
router.get(
  "/movements",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...inventoryValidators.getStockMovements],
  getStockMovements
);

// Create stock adjustment
router.post(
  "/adjust",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...inventoryValidators.createStockAdjustment],
  createStockAdjustment
);

// Get inventory summary
router.get("/summary", [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER")], getInventorySummary);

// Bulk stock update (from CSV or manual input)
router.post(
  "/bulk-update",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...inventoryValidators.bulkStockUpdate],
  bulkStockUpdate
);

// Stock transfer between locations
router.post(
  "/transfer",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...inventoryValidators.stockTransfer],
  stockTransfer
);

// Stock transfer between locations
// Stock transfer between locations (modular, uses controller)
router.post(
  "/transfer",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...inventoryValidators.stockTransfer],
  stockTransfer
);

// Get stock alerts
router.get(
  "/alerts",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...inventoryValidators.getStockAlerts],
  getStockAlerts
);

// Resolve stock alert
router.put("/alerts/:id/resolve", [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER")], resolveStockAlert);

// Receive purchase order
router.post(
  "/receive-purchase-order",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...inventoryValidators.receivePurchaseOrder],
  receivePurchaseOrder
);

// Get all purchase orders
router.get("/purchase-orders", [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER")], getPurchaseOrders);

// Get purchase order by ID
router.get(
  "/purchase-orders/:id",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER")],
  getPurchaseOrderById
);

// Create purchase order
router.post(
  "/purchase-orders",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...inventoryValidators.createPurchaseOrder],
  createPurchaseOrder
);

// Update purchase order
router.put(
  "/purchase-orders/:id",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...inventoryValidators.updatePurchaseOrder],
  updatePurchaseOrder
);

// Receive purchase order items
router.post(
  "/purchase-orders/:id/receive",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...inventoryValidators.receivePurchaseOrderItems],
  receivePurchaseOrderItems
);

// Cancel purchase order
router.delete(
  "/purchase-orders/:id",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER")],
  cancelPurchaseOrder
);

// Get purchase order statistics
router.get(
  "/purchase-orders/stats/summary",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER")],
  getPurchaseOrderStats
);

export const InventoryRoutes = router;
