import prisma from "../../prisma.js";

/**
 * Get subscription status for a store
 */
export async function getSubscriptionStatus(storeId) {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
  });

  if (!subscription) {
    return { error: "Subscription not found", status: 404 };
  }

  const now = new Date();
  const trialEndDate = new Date(subscription.trialEndDate);
  const daysRemaining = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));

  // Check if trial has expired
  if (subscription.status === "TRIAL" && now > trialEndDate) {
    await prisma.subscription.update({
      where: { storeId },
      data: { status: "EXPIRED" },
    });
    subscription.status = "EXPIRED";
  }

  // Determine if warning should be shown (3 days before trial ends)
  const showWarning = subscription.status === "TRIAL" && daysRemaining <= 3 && daysRemaining > 0;

  return {
    subscription: {
      status: subscription.status,
      trialStartDate: subscription.trialStartDate,
      trialEndDate: subscription.trialEndDate,
      subscriptionEndDate: subscription.subscriptionEndDate,
      plan: subscription.plan,
      daysRemaining: subscription.status === "TRIAL" ? daysRemaining : null,
      showWarning,
      warningShown: subscription.warningShown,
      isExpired: subscription.status === "EXPIRED",
      isActive: subscription.status === "ACTIVE" || (subscription.status === "TRIAL" && daysRemaining > 0),
    },
  };
}

/**
 * Activate subscription (after payment)
 */
export async function activateSubscription(storeId, { plan, paymentMethod, duration }) {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
  });

  if (!subscription) {
    return { error: "Subscription not found", status: 404 };
  }

  const now = new Date();
  const subscriptionEndDate = new Date();

  // Calculate subscription end date based on plan
  if (plan === "MONTHLY") {
    subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
  } else if (plan === "YEARLY") {
    subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
  } else if (plan === "LIFETIME") {
    subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 100);
  } else if (duration) {
    // Custom duration in days
    subscriptionEndDate.setDate(subscriptionEndDate.getDate() + duration);
  }

  const updated = await prisma.subscription.update({
    where: { storeId },
    data: {
      status: "ACTIVE",
      plan,
      paymentMethod,
      subscriptionStartDate: now,
      subscriptionEndDate,
      lastPaymentDate: now,
      warningShown: false,
    },
  });

  return { subscription: updated };
}

/**
 * Renew subscription (after payment for renewal)
 */
export async function renewSubscription(storeId, { plan, paymentMethod }) {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
  });

  if (!subscription) {
    return { error: "Subscription not found", status: 404 };
  }

  const now = new Date();
  const currentEndDate = subscription.subscriptionEndDate ? new Date(subscription.subscriptionEndDate) : new Date();
  const newEndDate = new Date(currentEndDate);

  // Extend from current end date or now, whichever is later
  const startFrom = currentEndDate > now ? currentEndDate : now;
  newEndDate.setTime(startFrom.getTime());

  // Add duration based on plan
  if (plan === "MONTHLY") {
    newEndDate.setMonth(newEndDate.getMonth() + 1);
  } else if (plan === "YEARLY") {
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);
  }

  const updated = await prisma.subscription.update({
    where: { storeId },
    data: {
      status: "ACTIVE",
      plan,
      paymentMethod,
      subscriptionEndDate: newEndDate,
      lastPaymentDate: now,
      warningShown: false,
    },
  });

  return { subscription: updated };
}

/**
 * Mark warning as shown
 */
export async function markWarningShown(storeId) {
  const updated = await prisma.subscription.update({
    where: { storeId },
    data: { warningShown: true },
  });

  return { subscription: updated };
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(storeId) {
  const updated = await prisma.subscription.update({
    where: { storeId },
    data: { status: "CANCELLED" },
  });

  return { subscription: updated };
}

/**
 * Check if store has active subscription
 */
export async function hasActiveSubscription(storeId) {
  const result = await getSubscriptionStatus(storeId);

  if (result.error) {
    return false;
  }

  return result.subscription.isActive;
}
