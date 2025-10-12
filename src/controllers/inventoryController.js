import * as inventoryService from "../services/inventoryService.js";
import { error, success } from "../utils/response.js";

export async function getStockMovements(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const productId = req.query.productId ? parseInt(req.query.productId) : undefined;
    const movementType = req.query.movementType;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const movements = await inventoryService.getStockMovementsService({
      page,
      limit,
      productId,
      movementType,
      startDate,
      endDate,
    });
    success(res, movements);
  } catch (err) {
    console.error("Get stock movements error:", err);
    error(res, "Failed to fetch stock movements", 500, err.message);
  }
}

export async function createStockAdjustment(req, res) {
  try {
    const result = await inventoryService.createStockAdjustmentService(req.body, req.user.id);
    success(res, result);
  } catch (err) {
    console.error("Stock adjustment error:", err);
    error(res, err.message || "Failed to adjust stock", 500, err.message);
  }
}

export async function getInventorySummary(req, res) {
  try {
    const summary = await inventoryService.getInventorySummaryService();
    success(res, summary);
  } catch (err) {
    console.error("Inventory summary error:", err);
    error(res, "Failed to generate inventory summary", 500, err.message);
  }
}

export async function bulkStockUpdate(req, res) {
  try {
    const result = await inventoryService.bulkStockUpdateService(req.body.updates, req.body.reason, req.user.id);
    success(res, result);
  } catch (err) {
    console.error("Bulk stock update error:", err);
    error(res, err.message || "Failed to update stock", 500, err.message);
  }
}

export async function stockTransfer(req, res) {
  try {
    const result = await inventoryService.stockTransferService(req.body, req.user.id);
    success(res, result, 201);
  } catch (err) {
    console.error("Stock transfer error:", err);
    error(res, err.message || "Failed to transfer stock", 500, err.message);
  }
}

export async function getStockAlerts(req, res) {
  try {
    const alerts = await inventoryService.getStockAlertsService(req.query);
    success(res, alerts);
  } catch (err) {
    console.error("Get alerts error:", err);
    error(res, "Failed to fetch stock alerts", 500, err.message);
  }
}

export async function resolveStockAlert(req, res) {
  try {
    const alert = await inventoryService.resolveStockAlertService(parseInt(req.params.id), req.user.id);
    success(res, alert);
  } catch (err) {
    console.error("Resolve alert error:", err);
    error(res, "Failed to resolve alert", 500, err.message);
  }
}

export async function receivePurchaseOrder(req, res) {
  try {
    const result = await inventoryService.receivePurchaseOrderService(req.body, req.user.id);
    success(res, result);
  } catch (err) {
    console.error("Receive PO error:", err);
    error(res, err.message || "Failed to receive purchase order", 500, err.message);
  }
}

export async function getPurchaseOrders(req, res) {
  try {
    const result = await inventoryService.getPurchaseOrdersService(req.query);
    success(res, result);
  } catch (err) {
    console.error("Error fetching purchase orders:", err);
    error(res, "Failed to fetch purchase orders", 500, err.message);
  }
}

export async function getPurchaseOrderById(req, res) {
  try {
    const result = await inventoryService.getPurchaseOrderByIdService(parseInt(req.params.id));
    if (!result) return error(res, "Purchase order not found", 404);
    success(res, result);
  } catch (err) {
    console.error("Error fetching purchase order:", err);
    error(res, "Failed to fetch purchase order", 500, err.message);
  }
}

export async function createPurchaseOrder(req, res) {
  try {
    const result = await inventoryService.createPurchaseOrderService(req.body, req.user.id);
    success(res, result, 201);
  } catch (err) {
    console.error("Error creating purchase order:", err);
    error(res, "Failed to create purchase order", 500, err.message);
  }
}

export async function updatePurchaseOrder(req, res) {
  try {
    const result = await inventoryService.updatePurchaseOrderService(parseInt(req.params.id), req.body, req.user.id);
    success(res, result);
  } catch (err) {
    console.error("Error updating purchase order:", err);
    error(res, "Failed to update purchase order", 500, err.message);
  }
}

export async function receivePurchaseOrderItems(req, res) {
  try {
    const result = await inventoryService.receivePurchaseOrderItemsService(
      parseInt(req.params.id),
      req.body.items,
      req.user.id
    );
    success(res, result);
  } catch (err) {
    console.error("Error receiving purchase order:", err);
    error(res, "Failed to receive purchase order", 500, err.message);
  }
}

export async function cancelPurchaseOrder(req, res) {
  try {
    const result = await inventoryService.cancelPurchaseOrderService(parseInt(req.params.id), req.user.id);
    success(res, result);
  } catch (err) {
    console.error("Error cancelling purchase order:", err);
    error(res, "Failed to cancel purchase order", 500, err.message);
  }
}

export async function getPurchaseOrderStats(req, res) {
  try {
    const result = await inventoryService.getPurchaseOrderStatsService(req.query);
    success(res, result);
  } catch (err) {
    console.error("Error fetching PO statistics:", err);
    error(res, "Failed to fetch statistics", 500, err.message);
  }
}
