import prisma from "../../prisma.js";

export const LOYALTY_TIERS = {
  BRONZE:   { min: 0,    multiplier: 1.0, discount: 0,  birthdayBonus: 50 },
  SILVER:   { min: 500,  multiplier: 1.25, discount: 5,  birthdayBonus: 100 },
  GOLD:     { min: 1500, multiplier: 1.5, discount: 10, birthdayBonus: 200 },
  PLATINUM: { min: 3000, multiplier: 2.0, discount: 15, birthdayBonus: 500 },
};
export const TIER_ORDER    = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
export const TIER_MINIMUMS = { BRONZE: 0, SILVER: 500, GOLD: 1500, PLATINUM: 3000 };

export async function getTiersService(storeId) {
  try {
    const tiers = await prisma.loyaltyTierConfig.findMany({ orderBy: { minimumPoints: "asc" } });
    if (tiers.length === 0) {
      return Object.entries(LOYALTY_TIERS).map(([tier, config]) => ({
        tier,
        minimumPoints:     config.min,
        pointsMultiplier:  config.multiplier,
        discountPercentage: config.discount,
        birthdayBonus:     config.birthdayBonus,
      }));
    }
    return tiers;
  } catch (error) {
    console.error("[LOYALTY] getTiersService DB error:", error);
    return Object.entries(LOYALTY_TIERS).map(([tier, config]) => ({
      tier,
      minimumPoints:     config.min,
      pointsMultiplier:  config.multiplier,
      discountPercentage: config.discount,
      birthdayBonus:     config.birthdayBonus,
    }));
  }
}

export async function getPointsHistoryService(customerId, storeId) {
  return prisma.pointsTransaction.findMany({
    where: { customerId },
    include: {
      sale: { select: { receiptId: true, finalAmount: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function redeemService({ customerId, pointsCost, rewardType, rewardValue, description, storeId }) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, storeId } });
    if (!customer) throw new Error("Customer not found in this store");
    if (customer.loyaltyPoints < pointsCost)
      throw new Error(`Insufficient points. Customer has ${customer.loyaltyPoints}, needs ${pointsCost}`);

    const updated = await tx.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { decrement: pointsCost } },
    });

    await tx.pointsTransaction.create({
      data: { customerId, type: "REDEEMED", points: -pointsCost, description: `Redeemed: ${description}` },
    });
    const reward = await tx.loyaltyReward.create({
      data: { customerId, rewardType, rewardValue, pointsCost, description, redeemedAt: new Date() },
    });
    return { reward, newBalance: updated.loyaltyPoints };
  });
}

export async function redeemPointsService({ customerId, points, rewardType, rewardValue, description, storeId }) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, storeId } });
    if (!customer) throw new Error("Customer not found in this store");
    if (customer.loyaltyPoints < points)
      throw new Error(`Insufficient points. Customer has ${customer.loyaltyPoints}, needs ${points}`);

    const updated = await tx.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { decrement: points } },
    });
    await tx.pointsTransaction.create({
      data: {
        customerId,
        type: "REDEEMED",
        points: -points,
        description: description || `Redeemed ${points} points for ${rewardType}`,
      },
    });

    let dbRewardType = "DISCOUNT_FIXED";
    if (rewardType === "FREE_PRODUCT") dbRewardType = "FREE_PRODUCT";

    const reward = await tx.loyaltyReward.create({
      data: {
        customerId,
        rewardType: dbRewardType,
        rewardValue: parseFloat(rewardValue),
        pointsCost: points,
        description: description || `${rewardType} reward`,
        redeemedAt: new Date(),
        isActive: false,
      },
    });
    return {
      success: true,
      reward,
      newBalance: updated.loyaltyPoints,
      pointsRedeemed: points,
      discountAmount: parseFloat(rewardValue),
    };
  });
}

export async function getRewardsService(customerId, storeId) {
  return prisma.loyaltyReward.findMany({
    where: {
      customerId,
      customer: { storeId },
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function awardPointsService({ customerId, saleId, amount, storeId }) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({ where: { id: customerId, storeId } });
    if (!customer) throw new Error("Customer not found in this store");

    const tierConfig = await tx.loyaltyTierConfig.findFirst({ where: { tier: customer.loyaltyTier } });
    const defaultMultipliers = { BRONZE: 1.0, SILVER: 1.25, GOLD: 1.5, PLATINUM: 2.0 };
    const multiplier = tierConfig?.pointsMultiplier || defaultMultipliers[customer.loyaltyTier] || 1.0;

    const basePoints  = Math.floor(amount / 10);
    const bonusPoints = Math.floor(basePoints * (multiplier - 1));
    const totalPoints = basePoints + bonusPoints;

    const updated = await tx.customer.update({
      where: { id: customerId },
      data: { loyaltyPoints: { increment: totalPoints } },
    });
    const transaction = await tx.pointsTransaction.create({
      data: {
        customerId,
        saleId,
        type: "EARNED",
        points: totalPoints,
        description: `Earned ${basePoints} base points${bonusPoints > 0 ? ` + ${bonusPoints} tier bonus (${customer.loyaltyTier})` : ""}`,
      },
    });
    const newTier = (() => {
      const total = customer.loyaltyPoints + totalPoints;
      if (total >= LOYALTY_TIERS.PLATINUM.min) return "PLATINUM";
      if (total >= LOYALTY_TIERS.GOLD.min)     return "GOLD";
      if (total >= LOYALTY_TIERS.SILVER.min)   return "SILVER";
      return "BRONZE";
    })();
    if (newTier !== customer.loyaltyTier) {
      await tx.customer.update({ where: { id: customerId }, data: { loyaltyTier: newTier } });
    }
    return { transaction, pointsAwarded: totalPoints, newBalance: updated.loyaltyPoints, newTier };
  });
}

export async function birthdayRewardsService(storeId) {
  const today      = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay   = today.getDate();
  const customers  = await prisma.customer.findMany({
    where: { storeId, isActive: true, dateOfBirth: { not: null } },
  });
  const birthdayCustomers = customers.filter((c) => {
    const d = new Date(c.dateOfBirth);
    return d.getMonth() + 1 === todayMonth && d.getDate() === todayDay;
  });
  const results = [];
  for (const customer of birthdayCustomers) {
    const birthdayBonus = LOYALTY_TIERS[customer.loyaltyTier]?.birthdayBonus || LOYALTY_TIERS.BRONZE.birthdayBonus;
    await prisma.customer.update({
      where: { id: customer.id },
      data: { loyaltyPoints: { increment: birthdayBonus } },
    });
    await prisma.pointsTransaction.create({
      data: {
        customerId: customer.id,
        type: "BIRTHDAY_BONUS",
        points: birthdayBonus,
        description: `Birthday bonus - ${customer.loyaltyTier} tier`,
      },
    });
    results.push({ customerId: customer.id, name: customer.name, bonus: birthdayBonus });
  }
  return { message: `Awarded birthday bonuses to ${results.length} customers`, customers: results };
}

export async function getOffersService(user, storeId) {
  const now     = new Date();
  const isAdmin = user && (user.role === "ADMIN" || user.role === "MANAGER");
  if (isAdmin) {
    return prisma.loyaltyOffer.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
  }
  return prisma.loyaltyOffer.findMany({
    where: { storeId, isActive: true, startDate: { lte: now }, endDate: { gte: now } },
    orderBy: { createdAt: "desc" },
  });
}

export async function createOfferService(data, storeId) {
  return prisma.loyaltyOffer.create({
    data: {
      ...data,
      storeId,
      minimumPurchase: data.minimumPurchase || 0,
      requiredTier:    data.requiredTier    || "BRONZE",
      startDate: new Date(data.startDate),
      endDate:   new Date(data.endDate),
    },
  });
}

export async function updateOfferService(offerId, data, storeId) {
  const updateData    = {};
  const allowedFields = ["title","description","offerType","discountValue","minimumPurchase","requiredTier","startDate","endDate","isActive"];
  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      if (field === "startDate" || field === "endDate") updateData[field] = new Date(data[field]);
      else updateData[field] = data[field];
    }
  });
  return prisma.loyaltyOffer.update({ where: { id: offerId, storeId }, data: updateData });
}

export async function deleteOfferService(offerId, storeId) {
  await prisma.loyaltyOffer.delete({ where: { id: offerId, storeId } });
  return { message: "Loyalty offer deleted successfully" };
}

export async function loyaltyTierConfigService(data, storeId) {
  return prisma.loyaltyTierConfig.upsert({
    where:  { tier: data.tier },
    update: {
      minimumPoints:     data.minimumPoints,
      pointsMultiplier:  data.pointsMultiplier,
      discountPercentage: data.discountPercentage,
      birthdayBonus:     data.birthdayBonus,
      description:       data.description,
    },
    create: {
      tier:              data.tier,
      minimumPoints:     data.minimumPoints,
      pointsMultiplier:  data.pointsMultiplier,
      discountPercentage: data.discountPercentage,
      birthdayBonus:     data.birthdayBonus,
      description:       data.description,
    },
  });
}

export async function getStatisticsService(user, storeId) {
  const customersByTierRaw = await prisma.customer.groupBy({
    by: ["loyaltyTier"],
    where: { storeId, isActive: true },
    _count: true,
  });
  const totalPointsIssued = await prisma.pointsTransaction.aggregate({
    where: { points: { gt: 0 }, customer: { storeId } },
    _sum: { points: true },
  });
  const totalPointsRedeemed = await prisma.pointsTransaction.aggregate({
    where: { type: "REDEEMED", customer: { storeId } },
    _sum: { points: true },
  });
  const now = new Date();
  const activeOffersCount = await prisma.loyaltyOffer.count({
    where: { isActive: true, storeId, startDate: { lte: now }, endDate: { gte: now } },
  });
  const recentRedemptions = await prisma.loyaltyReward.findMany({
    where: { redeemedAt: { not: null }, customer: { storeId } },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { redeemedAt: "desc" },
    take: 10,
  });
  const topCustomers = await prisma.customer.findMany({
    where: { storeId, isActive: true },
    orderBy: { loyaltyPoints: "desc" },
    take: 10,
    select: { id: true, name: true, loyaltyPoints: true, loyaltyTier: true },
  });
  const tierDistribution = { BRONZE: 0, SILVER: 0, GOLD: 0, PLATINUM: 0 };
  customersByTierRaw.forEach((item) => { tierDistribution[item.loyaltyTier] = item._count || 0; });
  return {
    customersByTier: tierDistribution,
    pointsIssued:    Math.abs(totalPointsIssued._sum.points    || 0),
    pointsRedeemed:  Math.abs(totalPointsRedeemed._sum.points  || 0),
    activeOffers:    activeOffersCount,
    recentRedemptions,
    topCustomers,
  };
}

export async function updateCustomerTierService(customerId, tier, storeId) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, storeId } });
  if (!customer) throw new Error("Customer not found in this store");
  return prisma.customer.update({ where: { id: customerId }, data: { loyaltyTier: tier } });
}

export async function getLoyaltyStatusService(customerId, storeId) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId },
    include: {
      pointsTransactions: { orderBy: { createdAt: "desc" }, take: 10 },
      loyaltyRewards: {
        where: { OR: [{ redeemedAt: null }, { expiresAt: { gte: new Date() } }] },
      },
    },
  });
  if (!customer) return null;

  const earnedPoints  = await prisma.pointsTransaction.aggregate({
    where: { customerId, points: { gt: 0 } },
    _sum: { points: true },
  });
  const lifetimePoints = earnedPoints._sum.points || 0;
  const tierConfig     = await prisma.loyaltyTierConfig.findUnique({ where: { tier: customer.loyaltyTier } });
  const currentTierConfig = tierConfig || {
    tier:               customer.loyaltyTier,
    minimumPoints:      TIER_MINIMUMS[customer.loyaltyTier] || 0,
    pointsMultiplier:   LOYALTY_TIERS[customer.loyaltyTier]?.multiplier || 1,
    discountPercentage: LOYALTY_TIERS[customer.loyaltyTier]?.discount   || 0,
    birthdayBonus:      LOYALTY_TIERS[customer.loyaltyTier]?.birthdayBonus || 0,
  };
  const currentIndex       = TIER_ORDER.indexOf(customer.loyaltyTier);
  const nextTier           = currentIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentIndex + 1] : null;
  const nextTierConfigFromDb = nextTier ? await prisma.loyaltyTierConfig.findUnique({ where: { tier: nextTier } }) : null;
  const nextTierConfig     = nextTierConfigFromDb || (nextTier ? LOYALTY_TIERS[nextTier] : null);
  const currentTierMin     = TIER_MINIMUMS[customer.loyaltyTier] || 0;
  const nextTierMin        = nextTier ? TIER_MINIMUMS[nextTier] || 0 : currentTierMin;
  const pointsNeededInTier = nextTierMin - currentTierMin;
  const pointsStillNeeded  = Math.max(0, nextTierMin - customer.loyaltyPoints);
  const pointsInCurrentTier = Math.max(0, customer.loyaltyPoints - currentTierMin);
  const now = new Date();
  const availableOffers = await prisma.loyaltyOffer.findMany({
    where: {
      storeId,
      isActive:  true,
      startDate: { lte: now },
      endDate:   { gte: now },
      OR: [{ requiredTier: customer.loyaltyTier }, { requiredTier: "BRONZE" }],
    },
  });
  return {
    customer: {
      id:          customer.id,
      name:        customer.name,
      tier:        customer.loyaltyTier,
      points:      customer.loyaltyPoints,
      dateOfBirth: customer.dateOfBirth,
    },
    points: { current: customer.loyaltyPoints, lifetime: lifetimePoints },
    tier: {
      current:            customer.loyaltyTier,
      multiplier:         currentTierConfig.pointsMultiplier,
      discountPercentage: currentTierConfig.discountPercentage,
      birthdayBonus:      currentTierConfig.birthdayBonus,
      next: nextTier
        ? {
            tier:              nextTier,
            minimumPoints:     nextTierMin,
            pointsNeeded:      pointsStillNeeded,
            progressPoints:    pointsInCurrentTier,
            totalPointsInTier: pointsNeededInTier,
          }
        : null,
    },
    recentTransactions: customer.pointsTransactions,
    activeRewards:      customer.loyaltyRewards,
    availableOffers,
  };
}
