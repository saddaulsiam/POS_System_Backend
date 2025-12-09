import { sendError, sendSuccess } from "../../utils/response.js";
import * as subscriptionService from "./subscriptionService.js";

/**
 * Get subscription status for current store
 */
export async function getSubscriptionStatus(req, res) {
  try {
    const { storeId } = req.user;
    const result = await subscriptionService.getSubscriptionStatus(storeId);

    if (result.error) {
      return sendError(res, result.error, result.status);
    }

    return sendSuccess(res, result);
  } catch (error) {
    console.error("Get subscription status error:", error);
    return sendError(res, "Failed to get subscription status", 500);
  }
}

/**
 * Activate subscription after payment
 */
export async function activateSubscription(req, res) {
  try {
    const { storeId } = req.user;
    const { plan, paymentMethod, duration } = req.body;

    const result = await subscriptionService.activateSubscription(storeId, {
      plan,
      paymentMethod,
      duration,
    });

    if (result.error) {
      return sendError(res, result.error, result.status);
    }

    return sendSuccess(res, result, 200);
  } catch (error) {
    console.error("Activate subscription error:", error);
    return sendError(res, "Failed to activate subscription", 500);
  }
}

/**
 * Renew subscription
 */
export async function renewSubscription(req, res) {
  try {
    const { storeId } = req.user;
    const { plan, paymentMethod } = req.body;

    const result = await subscriptionService.renewSubscription(storeId, {
      plan,
      paymentMethod,
    });

    if (result.error) {
      return sendError(res, result.error, result.status);
    }

    return sendSuccess(res, result, 200);
  } catch (error) {
    console.error("Renew subscription error:", error);
    return sendError(res, "Failed to renew subscription", 500);
  }
}

/**
 * Mark warning as shown
 */
export async function markWarningShown(req, res) {
  try {
    const { storeId } = req.user;
    const result = await subscriptionService.markWarningShown(storeId);

    return sendSuccess(res, result, 200);
  } catch (error) {
    console.error("Mark warning shown error:", error);
    return sendError(res, "Failed to update warning status", 500);
  }
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(req, res) {
  try {
    const { storeId } = req.user;
    const result = await subscriptionService.cancelSubscription(storeId);

    return sendSuccess(res, result, 200);
  } catch (error) {
    console.error("Cancel subscription error:", error);
    return sendError(res, "Failed to cancel subscription", 500);
  }
}
