import * as inventoryService from "./inventoryService.js";
import { sendError, sendSuccess } from "../../utils/response.js";

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
    sendSuccess(res, { movements });
  } catch (err) {
    console.error("Get stock movements error:", err);
    sendError(res, 500, "Failed to fetch stock movements", err.message);
  }
}

export async function createStockAdjustment(req, res) {
  try {
    const result = await inventoryService.createStockAdjustmentService(req.body, req.user.id);
    sendSuccess(res, result);
  } catch (err) {
    console.error("Stock adjustment error:", err);
    sendError(res, 500, err.message || "Failed to adjust stock", err.message);
  }
}

export async function getInventorySummary(req, res) {
  try {
    const summary = await inventoryService.getInventorySummaryService();
    sendSuccess(res, summary);
  } catch (err) {
    console.error("Inventory summary error:", err);
    sendError(res, 500, "Failed to generate inventory summary", err.message);
  }
}

export async function bulkStockUpdate(req, res) {
  try {
    const result = await inventoryService.bulkStockUpdateService(req.body.updates, req.body.reason, req.user.id);
    sendSuccess(res, result);
  } catch (err) {
    console.error("Bulk stock update error:", err);
    sendError(res, 500, err.message || "Failed to update stock", err.message);
  }
}

export async function stockTransfer(req, res) {
  try {
    const result = await inventoryService.stockTransferService(req.body, req.user.id);
    sendSuccess(res, result, 201);
  } catch (err) {
    console.error("Stock transfer error:", err);
    sendError(res, 500, err.message || "Failed to transfer stock", err.message);
  }
}

export async function getStockAlerts(req, res) {
  try {
    const alerts = await inventoryService.getStockAlertsService(req.query);
    sendSuccess(res, alerts);
  } catch (err) {
    console.error("Get alerts error:", err);
    sendError(res, 500, "Failed to fetch stock alerts", err.message);
  }
}

export async function resolveStockAlert(req, res) {
  try {
    const alert = await inventoryService.resolveStockAlertService(parseInt(req.params.id), req.user.id);
    sendSuccess(res, alert);
  } catch (err) {
    console.error("Resolve alert error:", err);
    sendError(res, 500, "Failed to resolve alert", err.message);
  }
}

export async function receivePurchaseOrder(req, res) {
  try {
    const result = await inventoryService.receivePurchaseOrderService(req.body, req.user.id);
    sendSuccess(res, result);
  } catch (err) {
    console.error("Receive PO error:", err);
    sendError(res, 500, err.message || "Failed to receive purchase order", err.message);
  }
}

export async function getPurchaseOrders(req, res) {
  try {
    const result = await inventoryService.getPurchaseOrdersService(req.query);
    sendSuccess(res, result);
  } catch (err) {
    console.error("Error fetching purchase orders:", err);
    sendError(res, 500, "Failed to fetch purchase orders", err.message);
  }
}

export async function getPurchaseOrderById(req, res) {
  try {
    const result = await inventoryService.getPurchaseOrderByIdService(parseInt(req.params.id));
    if (!result) return sendError(res, 404, "Purchase order not found");
    sendSuccess(res, result);
  } catch (err) {
    console.error("Error fetching purchase order:", err);
    sendError(res, 500, "Failed to fetch purchase order", err.message);
  }
}

export async function createPurchaseOrder(req, res) {
  try {
    const result = await inventoryService.createPurchaseOrderService(req.body, req.user.id);
    sendSuccess(res, result, 201);
  } catch (err) {
    console.error("Error creating purchase order:", err);
    sendError(res, 500, "Failed to create purchase order", err.message);
  }
}

export async function updatePurchaseOrder(req, res) {
  try {
    const result = await inventoryService.updatePurchaseOrderService(parseInt(req.params.id), req.body, req.user.id);
    sendSuccess(res, result);
  } catch (err) {
    console.error("Error updating purchase order:", err);
    sendError(res, 500, "Failed to update purchase order", err.message);
  }
}

export async function receivePurchaseOrderItems(req, res) {
  try {
    const result = await inventoryService.receivePurchaseOrderItemsService(
      parseInt(req.params.id),
      req.body.items,
      req.user.id
    );
    sendSuccess(res, result);
  } catch (err) {
    console.error("Error receiving purchase order:", err);
    sendError(res, 500, "Failed to receive purchase order", err.message);
  }
}

export async function cancelPurchaseOrder(req, res) {
  try {
    const result = await inventoryService.cancelPurchaseOrderService(parseInt(req.params.id), req.user.id);
    sendSuccess(res, result);
  } catch (err) {
    console.error("Error cancelling purchase order:", err);
    sendError(res, 500, "Failed to cancel purchase order", err.message);
  }
}

export async function getPurchaseOrderStats(req, res) {
  try {
    const result = await inventoryService.getPurchaseOrderStatsService(req.query);
    sendSuccess(res, result);
  } catch (err) {
    console.error("Error fetching PO statistics:", err);
    sendError(res, 500, "Failed to fetch statistics", err.message);
  }
}
