import prisma from "../../prisma.js";
import { hashPassword, generateToken, generateRefreshToken } from "../../utils/helpers.js";

export async function getAdminStatsService() {
  const totalStores = await prisma.store.count();
  
  const activeSubs = await prisma.subscription.count({
    where: { status: "ACTIVE" },
  });
  
  const trialSubs = await prisma.subscription.count({
    where: { status: "TRIAL" },
  });
  
  const expiredSubs = await prisma.subscription.count({
    where: { status: { in: ["EXPIRED", "CANCELLED"] } },
  });

  const globalSales = await prisma.sale.aggregate({
    _sum: { finalAmount: true },
  });
  const totalGMV = globalSales._sum.finalAmount || 0;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const monthlyPayments = await prisma.payment.aggregate({
    where: {
      status: "SUCCESS",
      createdAt: { gte: thirtyDaysAgo },
    },
    _sum: { amount: true },
  });
  const mrr = monthlyPayments._sum.amount || 0;

  const totalPayments = await prisma.payment.aggregate({
    where: { status: "SUCCESS" },
    _sum: { amount: true },
  });
  const totalRevenue = totalPayments._sum.amount || 0;

  const recentStores = await prisma.store.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      owner: {
        select: {
          name: true,
          email: true,
          phone: true,
          isActive: true,
        },
      },
      subscription: true,
    },
  });

  // Calculate monthly registrations for chart (last 6 months)
  const monthlyRegs = [];
  for (let i = 5; i >= 0; i--) {
    const start = new Date();
    start.setMonth(start.getMonth() - i);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const count = await prisma.store.count({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    });

    const monthLabel = start.toLocaleString("default", { month: "short" });
    monthlyRegs.push({ month: monthLabel, count });
  }

  return {
    stats: {
      totalStores,
      activeSubs,
      trialSubs,
      expiredSubs,
      totalGMV,
      mrr,
      totalRevenue,
    },
    recentStores,
    monthlyRegs,
  };
}

export async function getStoresService(page = 1, limit = 10, search = "", status = "") {
  const skip = (page - 1) * limit;

  const andConditions = [];

  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { owner: { name: { contains: search, mode: "insensitive" } } },
        { owner: { email: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  if (status) {
    if (status === "SUSPENDED") {
      andConditions.push({ owner: { isActive: false } });
    } else {
      andConditions.push({ subscription: { status } });
    }
  }

  const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

  const total = await prisma.store.count({ where: whereClause });
  
  const stores = await prisma.store.findMany({
    where: whereClause,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          phone: true,
          isActive: true,
        },
      },
      subscription: true,
    },
  });

  const dataWithMetrics = await Promise.all(
    stores.map(async (store) => {
      const employeeCount = await prisma.employee.count({ where: { storeId: store.id } });
      const productCount = await prisma.product.count({ where: { storeId: store.id } });
      const salesCount = await prisma.sale.count({ where: { storeId: store.id } });
      const salesSum = await prisma.sale.aggregate({
        where: { storeId: store.id },
        _sum: { finalAmount: true },
      });
      return {
        ...store,
        metrics: {
          employeeCount,
          productCount,
          salesCount,
          revenue: salesSum._sum.finalAmount || 0,
        },
      };
    })
  );

  return {
    data: dataWithMetrics,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function toggleStoreStatusService(storeId, isActive) {
  // Find store owner
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { ownerId: true },
  });

  if (!store) {
    throw new Error("Store not found");
  }

  // Update owner's active status (deactivating owner deactivates store login)
  await prisma.employee.update({
    where: { id: store.ownerId },
    data: { isActive },
  });

  // Deactivate all employees of this store for security
  await prisma.employee.updateMany({
    where: { storeId },
    data: { isActive },
  });

  return { message: `Store status updated to ${isActive ? "Active" : "Suspended"}` };
}

export async function getSubscriptionsService(page = 1, limit = 10, status = "") {
  const skip = (page - 1) * limit;
  const whereClause = status ? { status } : {};

  const total = await prisma.subscription.count({ where: whereClause });
  
  const subscriptions = await prisma.subscription.findMany({
    where: whereClause,
    skip,
    take: limit,
    orderBy: { updatedAt: "desc" },
    include: {
      store: {
        select: {
          name: true,
          owner: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  return {
    data: subscriptions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPaymentsService(page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const total = await prisma.payment.count();
  
  const payments = await prisma.payment.findMany({
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      store: {
        select: {
          name: true,
        },
      },
    },
  });

  return {
    data: payments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function resetStoreOwnerPinService(storeId, newPin) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { ownerId: true },
  });

  if (!store) {
    throw new Error("Store not found");
  }

  const hashedPin = await hashPassword(newPin);

  await prisma.employee.update({
    where: { id: store.ownerId },
    data: { pinCode: hashedPin },
  });

  return { message: "Store owner PIN reset successfully" };
}

export async function updateStoreSubscriptionService(storeId, { status, plan, endDate }) {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
  });

  if (!subscription) {
    throw new Error("Subscription record not found");
  }

  const updateData = {
    status,
    plan,
  };

  if (endDate) {
    updateData.subscriptionEndDate = new Date(endDate);
  } else if (endDate === null) {
    updateData.subscriptionEndDate = null;
  }

  const updated = await prisma.subscription.update({
    where: { storeId },
    data: updateData,
  });

  return { message: "Subscription updated successfully", subscription: updated };
}

export async function impersonateStoreService(storeId) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          storeId: true,
          refreshToken: true,
        },
      },
    },
  });

  if (!store) {
    throw new Error("Store not found");
  }

  if (!store.owner) {
    throw new Error("Store owner account not found");
  }

  if (!store.owner.isActive) {
    throw new Error("This store's owner account is deactivated/suspended");
  }

  const token = generateToken(store.owner.id, store.owner.role, store.id);
  const refreshToken = generateRefreshToken(store.owner.id);

  // Store refresh token in database
  await prisma.employee.update({
    where: { id: store.owner.id },
    data: { refreshToken },
  });

  return {
    token,
    refreshToken,
    user: {
      id: store.owner.id,
      name: store.owner.name,
      username: store.owner.username,
      role: store.owner.role,
      email: store.owner.email,
      storeId: store.id,
    },
  };
}

export async function deleteStoreService(storeId) {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
  });

  if (!store) {
    throw new Error("Store not found");
  }

  // Deleting the store record will cascade delete all associated tables automatically
  await prisma.store.delete({
    where: { id: storeId },
  });

  return { message: "Store and all associated data purged successfully" };
}
