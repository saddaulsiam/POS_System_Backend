import { sendError, sendSuccess } from "../../utils/response.js";
import {
  getAdminStatsService,
  getStoresService,
  toggleStoreStatusService,
  getSubscriptionsService,
  getPaymentsService,
  resetStoreOwnerPinService,
  updateStoreSubscriptionService,
  impersonateStoreService,
  deleteStoreService,
} from "./adminService.js";

export async function getAdminStats(req, res) {
  try {
    const stats = await getAdminStatsService();
    sendSuccess(res, stats);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to retrieve admin stats");
  }
}

export async function getStores(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const status = req.query.status || "";
    const result = await getStoresService(page, limit, search, status);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to retrieve stores list");
  }
}

export async function toggleStoreStatus(req, res) {
  try {
    const storeId = parseInt(req.params.id);
    const { isActive } = req.body;

    if (isNaN(storeId)) {
      return sendError(res, 400, "Invalid store ID");
    }
    if (typeof isActive !== "boolean") {
      return sendError(res, 400, "isActive status must be a boolean");
    }

    const result = await toggleStoreStatusService(storeId, isActive);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to update store status");
  }
}

export async function getSubscriptions(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || "";
    const result = await getSubscriptionsService(page, limit, status);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to retrieve subscriptions list");
  }
}

export async function getPayments(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const result = await getPaymentsService(page, limit);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to retrieve payments list");
  }
}

export async function resetStoreOwnerPin(req, res) {
  try {
    const storeId = parseInt(req.params.id);
    const { pinCode } = req.body;

    if (isNaN(storeId)) {
      return sendError(res, 400, "Invalid store ID");
    }
    if (!pinCode || pinCode.length < 4) {
      return sendError(res, 400, "PIN code must be at least 4 characters long");
    }

    const result = await resetStoreOwnerPinService(storeId, pinCode);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to reset store owner PIN");
  }
}

export async function updateStoreSubscription(req, res) {
  try {
    const storeId = parseInt(req.params.id);
    const { status, plan, endDate } = req.body;

    if (isNaN(storeId)) {
      return sendError(res, 400, "Invalid store ID");
    }
    if (!status || !plan) {
      return sendError(res, 400, "Subscription status and plan are required");
    }

    const result = await updateStoreSubscriptionService(storeId, { status, plan, endDate });
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to update subscription");
  }
}

export async function impersonateStore(req, res) {
  try {
    const storeId = parseInt(req.params.id);
    if (isNaN(storeId)) {
      return sendError(res, 400, "Invalid store ID");
    }
    const result = await impersonateStoreService(storeId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Impersonation failed");
  }
}

export async function deleteStore(req, res) {
  try {
    const storeId = parseInt(req.params.id);
    if (isNaN(storeId)) {
      return sendError(res, 400, "Invalid store ID");
    }
    const result = await deleteStoreService(storeId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to delete store");
  }
}
