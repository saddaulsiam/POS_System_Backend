import prisma from "../../prisma.js";

/**
 * Validate a promo code and calculate discount or days
 */
export async function validatePromoCodeService({ code, plan, storeId }) {
  if (!code) {
    throw new Error("Promo code is required");
  }

  const promo = await prisma.promoCode.findUnique({
    where: { code: code.toUpperCase().trim() },
  });

  if (!promo) {
    throw new Error("Invalid promo code");
  }

  if (!promo.isActive) {
    throw new Error("Promo code is inactive");
  }

  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    throw new Error("Promo code has expired");
  }

  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    throw new Error("Promo code usage limit has been reached");
  }

  // Restrict to plan if configured
  if (promo.applicablePlan && promo.applicablePlan !== "ALL" && promo.applicablePlan !== plan) {
    throw new Error(`This promo code is only valid for ${promo.applicablePlan.toLowerCase()} subscription checkouts`);
  }

  // Get current plan pricing dynamically
  const settings = await prisma.systemSettings.findFirst({ where: { id: 1 } });
  const monthlyPrice = settings?.monthlyPrice || 79.0;
  const yearlyPrice = settings?.yearlyPrice || 59.0;
  const planPrice = plan === "YEARLY" ? (yearlyPrice * 12) : monthlyPrice;

  let discountAmount = 0;
  let extendedTrialDays = 0;

  if (promo.type === "PERCENTAGE") {
    discountAmount = parseFloat(((promo.value * planPrice) / 100).toFixed(2));
  } else if (promo.type === "FIXED") {
    discountAmount = Math.min(promo.value, planPrice);
  } else if (promo.type === "TRIAL_EXTENSION") {
    extendedTrialDays = Math.round(promo.value);
  }

  const finalAmount = Math.max(0, planPrice - discountAmount);

  return {
    id: promo.id,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    originalAmount: planPrice,
    discountAmount,
    extendedTrialDays,
    finalAmount,
  };
}

/**
 * Create a new promo code
 */
export async function createPromoCodeService({ code, type, value, applicablePlan, maxUses, expiresAt }) {
  if (!code || !type || value === undefined) {
    throw new Error("Code, type, and value are required");
  }

  const cleanCode = code.toUpperCase().trim();
  const existing = await prisma.promoCode.findUnique({
    where: { code: cleanCode },
  });

  if (existing) {
    throw new Error("Promo code already exists");
  }

  return await prisma.promoCode.create({
    data: {
      code: cleanCode,
      type,
      value: parseFloat(value.toString()),
      applicablePlan: applicablePlan || "ALL",
      maxUses: maxUses ? parseInt(maxUses.toString()) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });
}

/**
 * Get all promo codes
 */
export async function getPromoCodesService() {
  return await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Toggle promo code status
 */
export async function togglePromoCodeStatusService(id) {
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) {
    throw new Error("Promo code not found");
  }

  return await prisma.promoCode.update({
    where: { id },
    data: { isActive: !promo.isActive },
  });
}

/**
 * Delete a promo code
 */
export async function deletePromoCodeService(id) {
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) {
    throw new Error("Promo code not found");
  }

  return await prisma.promoCode.delete({ where: { id } });
}

/**
 * Update an existing promo code
 */
export async function updatePromoCodeService(id, { code, type, value, applicablePlan, maxUses, expiresAt }) {
  const promo = await prisma.promoCode.findUnique({ where: { id } });
  if (!promo) {
    throw new Error("Promo code not found");
  }

  const cleanCode = code ? code.toUpperCase().trim() : undefined;
  if (cleanCode && cleanCode !== promo.code) {
    const existing = await prisma.promoCode.findUnique({
      where: { code: cleanCode },
    });
    if (existing) {
      throw new Error("Promo code name already exists");
    }
  }

  return await prisma.promoCode.update({
    where: { id },
    data: {
      code: cleanCode,
      type,
      value: value !== undefined ? parseFloat(value.toString()) : undefined,
      applicablePlan,
      maxUses: maxUses !== undefined ? (maxUses ? parseInt(maxUses.toString()) : null) : undefined,
      expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : undefined,
    },
  });
}

/**
 * Apply a trial extension code to a merchant's subscription
 */
export async function applyTrialPromoService({ storeId, code }) {
  const validation = await validatePromoCodeService({ code, plan: "MONTHLY", storeId });

  if (validation.type !== "TRIAL_EXTENSION") {
    throw new Error("This promo code is only valid for checkout payments");
  }

  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
  });

  if (!subscription) {
    throw new Error("Subscription record not found");
  }

  const newTrialEndDate = new Date(subscription.trialEndDate);
  newTrialEndDate.setDate(newTrialEndDate.getDate() + validation.extendedTrialDays);

  // Perform database update in a transaction
  return await prisma.$transaction(async (tx) => {
    // 1. Extend the trial end date
    const updatedSub = await tx.subscription.update({
      where: { storeId },
      data: { 
        trialEndDate: newTrialEndDate,
        status: subscription.status === "EXPIRED" ? "TRIAL" : subscription.status // Re-activate if expired
      },
    });

    // 2. Increment used count on promo code
    await tx.promoCode.update({
      where: { code: validation.code },
      data: { usedCount: { increment: 1 } },
    });

    return updatedSub;
  });
}
