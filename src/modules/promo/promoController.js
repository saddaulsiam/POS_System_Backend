import { sendSuccess, sendError } from "../../utils/response.js";
import { logPlatformAction } from "../admin/adminService.js";
import {
  validatePromoCodeService,
  createPromoCodeService,
  getPromoCodesService,
  togglePromoCodeStatusService,
  deletePromoCodeService,
  applyTrialPromoService,
} from "./promoService.js";

export async function validatePromoCode(req, res) {
  try {
    const { code, plan } = req.body;
    const storeId = req.user?.storeId; // Optional, only if logged in
    
    if (!code || !plan) {
      return sendError(res, 400, "Code and plan details are required");
    }

    const result = await validatePromoCodeService({ code, plan, storeId });
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 400, error.message || "Failed to validate promo code");
  }
}

export async function createPromoCode(req, res) {
  try {
    const { code, type, value, maxUses, expiresAt } = req.body;
    const result = await createPromoCodeService({ code, type, value, maxUses, expiresAt });
    
    await logPlatformAction(
      "PROMO_CREATE",
      `Created coupon code: ${code.toUpperCase()} (${type}: ${value})`,
      req.ip,
      req.headers["user-agent"] || "",
      req.user?.username
    );

    sendSuccess(res, result, "Promo code created successfully");
  } catch (error) {
    sendError(res, 400, error.message || "Failed to create promo code");
  }
}

export async function getPromoCodes(req, res) {
  try {
    const result = await getPromoCodesService();
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to retrieve promo codes");
  }
}

export async function togglePromoCodeStatus(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return sendError(res, 400, "Invalid promo code ID");
    }

    const result = await togglePromoCodeStatusService(id);
    
    await logPlatformAction(
      "PROMO_TOGGLE",
      `Toggled status of coupon ID ${id} to ${result.isActive}`,
      req.ip,
      req.headers["user-agent"] || "",
      req.user?.username
    );

    sendSuccess(res, result, "Promo code status updated");
  } catch (error) {
    sendError(res, 400, error.message || "Failed to toggle status");
  }
}

export async function deletePromoCode(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return sendError(res, 400, "Invalid promo code ID");
    }

    const result = await deletePromoCodeService(id);
    
    await logPlatformAction(
      "PROMO_DELETE",
      `Deleted coupon ID ${id} (${result.code})`,
      req.ip,
      req.headers["user-agent"] || "",
      req.user?.username
    );

    sendSuccess(res, result, "Promo code deleted successfully");
  } catch (error) {
    sendError(res, 400, error.message || "Failed to delete promo code");
  }
}

export async function applyTrialPromo(req, res) {
  try {
    const { code } = req.body;
    const storeId = req.user?.storeId;

    if (!storeId) {
      return sendError(res, 400, "Store context not found in request");
    }

    if (!code) {
      return sendError(res, 400, "Promo code is required");
    }

    const result = await applyTrialPromoService({ storeId, code });
    sendSuccess(res, result, "Trial period extended successfully!");
  } catch (error) {
    sendError(res, 400, error.message || "Failed to apply trial code");
  }
}
