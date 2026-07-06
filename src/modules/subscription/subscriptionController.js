import { sendError, sendSuccess } from "../../utils/response.js";
import * as subscriptionService from "./subscriptionService.js";

/**
 * Get subscription status for current store
 */
export async function getSubscriptionStatus(req, res) {
  try {
    const { storeId, role } = req.user;

    // Super Admin has bypass access
    if (role === "SUPER_ADMIN") {
      return sendSuccess(res, {
        subscription: {
          status: "ACTIVE",
          trialStartDate: new Date().toISOString(),
          trialEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
          subscriptionEndDate: null,
          plan: "LIFETIME",
          daysRemaining: 365,
          showWarning: false,
          warningShown: false,
          isExpired: false,
          isActive: true,
        },
      });
    }

    const result = await subscriptionService.getSubscriptionStatus(storeId);

    if (result.error) {
      return sendError(res, result.status || 500, result.error);
    }

    return sendSuccess(res, result);
  } catch (error) {
    console.error("Get subscription status error:", error);
    return sendError(res, 500, "Failed to get subscription status");
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
      return sendError(res, result.status || 500, result.error);
    }

    return sendSuccess(res, result, 200);
  } catch (error) {
    console.error("Activate subscription error:", error);
    return sendError(res, 500, "Failed to activate subscription");
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
      return sendError(res, result.status || 500, result.error);
    }

    return sendSuccess(res, result, 200);
  } catch (error) {
    console.error("Renew subscription error:", error);
    return sendError(res, 500, "Failed to renew subscription");
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
    return sendError(res, 500, "Failed to update warning status");
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
    return sendError(res, 500, "Failed to cancel subscription");
  }
}
