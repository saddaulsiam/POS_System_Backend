import prisma from "../../prisma.js";

export const LOYALTY_TIERS = {
  BRONZE: { min: 0, multiplier: 1.0, discount: 0, birthdayBonus: 50 },
  SILVER: { min: 500, multiplier: 1.25, discount: 5, birthdayBonus: 100 },
  GOLD: { min: 1500, multiplier: 1.5, discount: 10, birthdayBonus: 200 },
  PLATINUM: { min: 3000, multiplier: 2.0, discount: 15, birthdayBonus: 500 },
};
export const TIER_ORDER = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
export const TIER_MINIMUMS = { BRONZE: 0, SILVER: 500, GOLD: 1500, PLATINUM: 3000 };

export async function getTiersService(storeId) {
  try {
    const tiers = await prisma.loyaltyTierConfig.findMany({ where: { storeId }, orderBy: { minimumPoints: "asc" } });
    if (tiers.length === 0) {
      return Object.entries(LOYALTY_TIERS).map(([tier, config]) => ({
        tier,
        minimumPoints: config.min,
        pointsMultiplier: config.multiplier,
        discountPercentage: config.discount,
        birthdayBonus: config.birthdayBonus,
      }));
    }
    return tiers;
  } catch (error) {
    console.error("[LOYALTY] getTiersService DB error:", error);
    return Object.entries(LOYALTY_TIERS).map(([tier, config]) => ({
      tier,
      minimumPoints: config.min,
      pointsMultiplier: config.multiplier,
      discountPercentage: config.discount,
      birthdayBonus: config.birthdayBonus,
    }));
  }
}

export async function getPointsHistoryService(customerId, storeId) {
  return prisma.pointsTransaction.findMany({
    where: { customerId, storeId },
    include: {
      sale: { select: { receiptId: true, finalAmount: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function redeemService({ customerId, pointsCost, rewardType, rewardValue, description, storeId }) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId, storeId } });
    if (!customer) throw new Error("Customer not found");
    if (customer.loyaltyPoints < pointsCost)
      throw new Error(`Insufficient points. Customer has ${customer.loyaltyPoints}, needs ${pointsCost}`);
    await tx.customer.update({
      where: { id: customerId, storeId },
      data: { loyaltyPoints: { decrement: pointsCost } },
    });
    await tx.pointsTransaction.create({
      data: { customerId, storeId, type: "REDEEMED", points: -pointsCost, description: `Redeemed: ${description}` },
    });
    const reward = await tx.loyaltyReward.create({
      data: { customerId, storeId, rewardType, rewardValue, pointsCost, description, redeemedAt: new Date() },
    });
    return { reward, newBalance: customer.loyaltyPoints - pointsCost };
  });
}

export async function redeemPointsService({ customerId, points, rewardType, rewardValue, description, storeId }) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId, storeId } });
    if (!customer) throw new Error("Customer not found");
    if (customer.loyaltyPoints < points)
      throw new Error(`Insufficient points. Customer has ${customer.loyaltyPoints}, needs ${points}`);
    const updatedCustomer = await tx.customer.update({
      where: { id: customerId, storeId },
      data: { loyaltyPoints: { decrement: points } },
    });
    await tx.pointsTransaction.create({
      data: {
        customerId,
        storeId,
        type: "REDEEMED",
        points: -points,
        description: description || `Redeemed ${points} points for ${rewardType}`,
      },
    });
    let dbRewardType = "DISCOUNT_FIXED";
    if (rewardType === "DISCOUNT") dbRewardType = "DISCOUNT_FIXED";
    else if (rewardType === "FREE_PRODUCT") dbRewardType = "FREE_PRODUCT";
    else if (["STORE_CREDIT", "SPECIAL_OFFER"].includes(rewardType)) dbRewardType = "DISCOUNT_FIXED";
    const reward = await tx.loyaltyReward.create({
      data: {
        customerId,
        storeId,
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
      newBalance: updatedCustomer.loyaltyPoints,
      pointsRedeemed: points,
      discountAmount: parseFloat(rewardValue),
    };
  });
}

export async function getRewardsService(customerId, storeId) {
  return prisma.loyaltyReward.findMany({
    where: { customerId, storeId, isActive: true, OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
    orderBy: { createdAt: "desc" },
  });
}

export async function awardPointsService({ customerId, saleId, amount, storeId }) {
  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId, storeId } });
    if (!customer) throw new Error("Customer not found");
    const tierConfig = LOYALTY_TIERS[customer.loyaltyTier] || LOYALTY_TIERS.BRONZE;
    const basePoints = Math.floor(amount / 10);
    const bonusPoints = Math.floor(basePoints * (tierConfig.multiplier - 1));
    const totalPoints = basePoints + bonusPoints;
    await tx.customer.update({
      where: { id: customerId, storeId },
      data: { loyaltyPoints: { increment: totalPoints } },
    });
    const transaction = await tx.pointsTransaction.create({
      data: {
        customerId,
        storeId,
        saleId,
        type: "EARNED",
        points: totalPoints,
        description: `Earned ${basePoints} base points${
          bonusPoints > 0 ? ` + ${bonusPoints} tier bonus (${customer.loyaltyTier})` : ""
        }`,
      },
    });
    // Calculate new tier
    const newTier = (() => {
      if (customer.loyaltyPoints + totalPoints >= LOYALTY_TIERS.PLATINUM.min) return "PLATINUM";
      if (customer.loyaltyPoints + totalPoints >= LOYALTY_TIERS.GOLD.min) return "GOLD";
      if (customer.loyaltyPoints + totalPoints >= LOYALTY_TIERS.SILVER.min) return "SILVER";
      return "BRONZE";
    })();
    if (newTier !== customer.loyaltyTier) {
      await tx.customer.update({ where: { id: customerId, storeId }, data: { loyaltyTier: newTier } });
    }
    return { transaction, pointsAwarded: totalPoints, newBalance: customer.loyaltyPoints + totalPoints, newTier };
  });
}

export async function birthdayRewardsService(storeId) {
  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();
  const customers = await prisma.customer.findMany({
    where: {
      isActive: true,
      storeId,
      dateOfBirth: { not: null },
      AND: [
        prisma.$queryRaw`CAST(strftime('%m', dateOfBirth) AS INTEGER) = ${todayMonth}`,
        prisma.$queryRaw`CAST(strftime('%d', dateOfBirth) AS INTEGER) = ${todayDay}`,
      ],
    },
  });
  const results = [];
  for (const customer of customers) {
    const birthdayBonus = LOYALTY_TIERS[customer.loyaltyTier]?.birthdayBonus || LOYALTY_TIERS.BRONZE.birthdayBonus;
    await prisma.customer.update({
      where: { id: customer.id, storeId },
      data: { loyaltyPoints: { increment: birthdayBonus } },
    });
    await prisma.pointsTransaction.create({
      data: {
        customerId: customer.id,
        storeId,
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
  const now = new Date();
  const isAdmin = user && (user.role === "ADMIN" || user.role === "MANAGER");
  if (isAdmin) {
    return prisma.loyaltyOffer.findMany({ where: { storeId }, orderBy: { createdAt: "desc" } });
  } else {
    return prisma.loyaltyOffer.findMany({
      where: { storeId, isActive: true, startDate: { lte: now }, endDate: { gte: now } },
      orderBy: { createdAt: "desc" },
    });
  }
}

export async function createOfferService(data, storeId) {
  return prisma.loyaltyOffer.create({
    data: {
      ...data,
      storeId,
      minimumPurchase: data.minimumPurchase || 0,
      requiredTier: data.requiredTier || "BRONZE",
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    },
  });
}

export async function updateOfferService(offerId, data, storeId) {
  const updateData = {};
  const allowedFields = [
    "title",
    "description",
    "offerType",
    "discountValue",
    "minimumPurchase",
    "requiredTier",
    "startDate",
    "endDate",
    "isActive",
  ];
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
    where: { tier_storeId: { tier: data.tier, storeId } },
    update: {
      minimumPoints: data.minimumPoints,
      pointsMultiplier: data.pointsMultiplier,
      discountPercentage: data.discountPercentage,
      birthdayBonus: data.birthdayBonus,
      description: data.description,
    },
    create: {
      tier: data.tier,
      storeId,
      minimumPoints: data.minimumPoints,
      pointsMultiplier: data.pointsMultiplier,
      discountPercentage: data.discountPercentage,
      birthdayBonus: data.birthdayBonus,
      description: data.description,
    },
  });
}

export async function getStatisticsService(user, storeId) {
  const customersByTier = await prisma.customer.groupBy({
    by: ["loyaltyTier"],
    where: { isActive: true, storeId },
    _count: true,
  });
  const totalPointsIssued = await prisma.pointsTransaction.aggregate({
    where: { points: { gt: 0 }, storeId },
    _sum: { points: true },
  });
  const totalPointsRedeemed = await prisma.pointsTransaction.aggregate({
    where: { type: "REDEEMED", storeId },
    _sum: { points: true },
  });
  const now = new Date();
  const activeOffersCount = await prisma.loyaltyOffer.count({
    where: { isActive: true, storeId, startDate: { lte: now }, endDate: { gte: now } },
  });
  const recentRedemptions = await prisma.loyaltyReward.findMany({
    where: { redeemedAt: { not: null }, storeId },
    include: { customer: { select: { id: true, name: true } } },
    orderBy: { redeemedAt: "desc" },
    take: 10,
  });
  const topCustomers = await prisma.customer.findMany({
    where: { isActive: true, storeId },
    orderBy: { loyaltyPoints: "desc" },
    take: 10,
    select: { id: true, name: true, loyaltyPoints: true, loyaltyTier: true },
  });
  const tierDistribution = {};
  const allTiers = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
  allTiers.forEach((tier) => {
    tierDistribution[tier] = 0;
  });
  customersByTier.forEach((item) => {
    tierDistribution[item.loyaltyTier] = item._count || 0;
  });
  return {
    customersByTier: tierDistribution,
    pointsIssued: Math.abs(totalPointsIssued._sum.points || 0),
    pointsRedeemed: Math.abs(totalPointsRedeemed._sum.points || 0),
    activeOffers: activeOffersCount,
    recentRedemptions,
    topCustomers,
  };
}

export async function updateCustomerTierService(customerId, tier, storeId) {
  return prisma.customer.update({
    where: { id: customerId, storeId },
    data: { loyaltyTier: tier },
  });
}

export async function getLoyaltyStatusService(customerId, storeId) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId, storeId },
    include: {
      pointsTransactions: { where: { storeId }, orderBy: { createdAt: "desc" }, take: 10 },
      loyaltyRewards: { where: { storeId, OR: [{ redeemedAt: null }, { expiresAt: { gte: new Date() } }] } },
    },
  });
  if (!customer) return null;
  const earnedPoints = await prisma.pointsTransaction.aggregate({
    where: { customerId, storeId, points: { gt: 0 } },
    _sum: { points: true },
  });
  const lifetimePoints = earnedPoints._sum.points || 0;
  const tierConfig = await prisma.loyaltyTierConfig.findUnique({
    where: { tier_storeId: { tier: customer.loyaltyTier, storeId } },
  });
  const currentTierConfig = tierConfig || {
    tier: customer.loyaltyTier,
    minimumPoints: TIER_MINIMUMS[customer.loyaltyTier] || 0,
    pointsMultiplier: LOYALTY_TIERS[customer.loyaltyTier]?.multiplier || 1,
    discountPercentage: LOYALTY_TIERS[customer.loyaltyTier]?.discount || 0,
    birthdayBonus: LOYALTY_TIERS[customer.loyaltyTier]?.birthdayBonus || 0,
  };
  const currentIndex = TIER_ORDER.indexOf(customer.loyaltyTier);
  const nextTier = currentIndex < TIER_ORDER.length - 1 ? TIER_ORDER[currentIndex + 1] : null;
  const nextTierConfigFromDb = nextTier
    ? await prisma.loyaltyTierConfig.findUnique({ where: { tier_storeId: { tier: nextTier, storeId } } })
    : null;
  const nextTierConfig = nextTierConfigFromDb || (nextTier ? LOYALTY_TIERS[nextTier] : null);
  const currentTierMin = TIER_MINIMUMS[customer.loyaltyTier] || 0;
  const nextTierMin = nextTier ? TIER_MINIMUMS[nextTier] || 0 : currentTierMin;
  const currentPoints = customer.loyaltyPoints;
  const pointsNeededInTier = nextTierMin - currentTierMin;
  const pointsStillNeeded = Math.max(0, nextTierMin - currentPoints);
  const pointsInCurrentTier = Math.max(0, currentPoints - currentTierMin);
  const now = new Date();
  const availableOffers = await prisma.loyaltyOffer.findMany({
    where: {
      storeId,
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
      OR: [{ requiredTier: customer.loyaltyTier }, { requiredTier: "BRONZE" }],
    },
  });
  return {
    customer: {
      id: customer.id,
      name: customer.name,
      tier: customer.loyaltyTier,
      points: customer.loyaltyPoints,
      dateOfBirth: customer.dateOfBirth,
    },
    points: {
      current: customer.loyaltyPoints,
      lifetime: lifetimePoints,
    },
    tier: {
      current: customer.loyaltyTier,
      multiplier: currentTierConfig.pointsMultiplier,
      discountPercentage: currentTierConfig.discountPercentage,
      birthdayBonus: currentTierConfig.birthdayBonus,
      next: nextTier
        ? {
            tier: nextTier,
            minimumPoints: nextTierMin,
            pointsNeeded: pointsStillNeeded,
            progressPoints: pointsInCurrentTier,
            totalPointsInTier: pointsNeededInTier,
          }
        : null,
    },
    recentTransactions: customer.pointsTransactions,
    activeRewards: customer.loyaltyRewards,
    availableOffers,
  };
}
