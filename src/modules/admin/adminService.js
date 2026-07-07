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

export async function getStoresService(
  page = 1,
  limit = 10,
  search = "",
  status = "",
  plan = "",
  sortBy = "",
  dateJoined = "",
) {
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

  if (plan) {
    andConditions.push({ subscription: { plan } });
  }

  if (dateJoined) {
    const dateLimit = new Date();
    if (dateJoined === "7days") {
      dateLimit.setDate(dateLimit.getDate() - 7);
      andConditions.push({ createdAt: { gte: dateLimit } });
    } else if (dateJoined === "30days") {
      dateLimit.setDate(dateLimit.getDate() - 30);
      andConditions.push({ createdAt: { gte: dateLimit } });
    }
  }

  const whereClause = andConditions.length > 0 ? { AND: andConditions } : {};

  // Dynamic sorting
  let orderBy = { createdAt: "desc" };
  if (sortBy === "oldest") {
    orderBy = { createdAt: "asc" };
  } else if (sortBy === "name_asc") {
    orderBy = { name: "asc" };
  } else if (sortBy === "name_desc") {
    orderBy = { name: "desc" };
  } else if (sortBy === "sales_desc") {
    orderBy = { sales: { _count: "desc" } };
  } else if (sortBy === "products_desc") {
    orderBy = { products: { _count: "desc" } };
  }

  const total = await prisma.store.count({ where: whereClause });

  const stores = await prisma.store.findMany({
    where: whereClause,
    skip,
    take: limit,
    orderBy,
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
    }),
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

export async function getSubscriptionsService(page = 1, limit = 10, search = "", status = "", plan = "") {
  const skip = (page - 1) * limit;
  const whereClause = {};

  if (status) {
    whereClause.status = status;
  }

  if (plan) {
    whereClause.plan = plan;
  }

  if (search) {
    whereClause.OR = [
      { store: { name: { contains: search, mode: "insensitive" } } },
      { store: { owner: { name: { contains: search, mode: "insensitive" } } } },
      { store: { owner: { email: { contains: search, mode: "insensitive" } } } },
    ];
  }

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

  // Calculate SaaS Summary Statistics
  const totalPaid = await prisma.subscription.count({ where: { status: "ACTIVE" } });
  const totalTrial = await prisma.subscription.count({ where: { status: "TRIAL" } });
  const totalExpired = await prisma.subscription.count({ where: { status: "EXPIRED" } });

  const threeDaysFromNow = new Date();
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const totalExpiringSoon = await prisma.subscription.count({
    where: {
      OR: [
        {
          status: "ACTIVE",
          subscriptionEndDate: {
            gte: new Date(),
            lte: threeDaysFromNow,
          },
        },
        {
          status: "TRIAL",
          trialEndDate: {
            gte: new Date(),
            lte: threeDaysFromNow,
          },
        },
      ],
    },
  });

  return {
    data: subscriptions,
    summary: {
      totalPaid,
      totalTrial,
      totalExpired,
      totalExpiringSoon,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPaymentsService(page = 1, limit = 10, search = "", status = "", plan = "") {
  const skip = (page - 1) * limit;
  const whereClause = {};

  if (status) {
    whereClause.status = status;
  }

  if (plan) {
    whereClause.plan = plan;
  }

  if (search) {
    whereClause.OR = [
      { transactionId: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
      { customerPhone: { contains: search, mode: "insensitive" } },
      { store: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  const total = await prisma.payment.count({ where: whereClause });

  const payments = await prisma.payment.findMany({
    where: whereClause,
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

export async function updateStoreSubscriptionService(storeId, { status, plan, endDate, gracePeriodDays }) {
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

  if (typeof gracePeriodDays === "number") {
    updateData.gracePeriodDays = gracePeriodDays;
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

export async function extendSubscriptionService(id, days) {
  const sub = await prisma.subscription.findUnique({
    where: { id },
  });

  if (!sub) {
    throw new Error("Subscription record not found");
  }

  let updateData = {};

  if (sub.status === "TRIAL") {
    const currentEnd = new Date(sub.trialEndDate);
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    updateData = {
      trialEndDate: baseDate,
      status: "TRIAL", // Keep trial
    };
  } else {
    // ACTIVE, EXPIRED, CANCELLED
    const currentEnd = sub.subscriptionEndDate ? new Date(sub.subscriptionEndDate) : new Date();
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    updateData = {
      subscriptionEndDate: baseDate,
      status: "ACTIVE", // Force status back to active
    };
  }

  const updated = await prisma.subscription.update({
    where: { id },
    data: updateData,
  });

  return { message: `Subscription extended by ${days} days successfully`, subscription: updated };
}

export async function logPlatformAction(action, details, ipAddress, userAgent, adminName) {
  try {
    await prisma.platformAuditLog.create({
      data: {
        action,
        details,
        ipAddress,
        userAgent,
        adminName,
      },
    });
  } catch (error) {
    console.error("[AUDIT LOG ERROR]", error);
  }
}

export async function getSystemSettingsService() {
  return await prisma.systemSettings.findUnique({
    where: { id: 1 },
  });
}

export async function updateSystemSettingsService(data) {
  return await prisma.systemSettings.update({
    where: { id: 1 },
    data: {
      defaultTrialDays: parseInt(data.defaultTrialDays),
      monthlyPrice: parseFloat(data.monthlyPrice),
      yearlyPrice: parseFloat(data.yearlyPrice),
      supportEmail: data.supportEmail,
      smtpHost: data.smtpHost || null,
      smtpPort: data.smtpPort ? parseInt(data.smtpPort) : null,
      smtpUser: data.smtpUser || null,
      smtpPass: data.smtpPass || null,
    },
  });
}

export async function getPublicSettingsService() {
  return await prisma.systemSettings.findUnique({
    where: { id: 1 },
    select: {
      defaultTrialDays: true,
      monthlyPrice: true,
      yearlyPrice: true,
      supportEmail: true,
    },
  });
}

export async function broadcastAnnouncementsService({ subject, body, targetAudience }) {
  const whereClause = {};
  if (targetAudience === "TRIAL") {
    whereClause.subscription = { status: "TRIAL" };
  } else if (targetAudience === "ACTIVE") {
    whereClause.subscription = { status: "ACTIVE" };
  } else if (targetAudience === "EXPIRED") {
    whereClause.subscription = { status: "EXPIRED" };
  }

  const stores = await prisma.store.findMany({
    where: whereClause,
    include: {
      owner: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  const recipients = stores
    .map((s) => s.owner)
    .filter((o) => o && o.email);

  const { sendEmail } = await import("../../utils/mailer.js");

  let successCount = 0;
  let failCount = 0;

  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject: subject,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #4f46e5; margin-bottom: 20px;">Announcement from POS Platform</h2>
            <p>Dear <strong>${recipient.name}</strong>,</p>
            <div style="line-height: 1.6; color: #374151;">
              ${body}
            </div>
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
            <p style="font-size: 11px; color: #9ca3af; text-align: center;">This is an administrative broadcast from Smart POS Platform. support@pos-platform.com</p>
          </div>
        `,
      });
      successCount++;
    } catch (err) {
      console.error(`Failed to send broadcast email to ${recipient.email}:`, err);
      failCount++;
    }
  }

  return {
    totalRecipients: recipients.length,
    successCount,
    failCount,
  };
}

export async function sendRenewalReminderService(subscriptionId) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      store: {
        include: {
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

  if (!subscription) {
    throw new Error("Subscription record not found");
  }

  if (!subscription.store?.owner?.email) {
    throw new Error("Store owner email address is not registered");
  }

  const { sendEmail } = await import("../../utils/mailer.js");
  const owner = subscription.store.owner;

  const expiredDate = subscription.plan 
    ? new Date(subscription.subscriptionEndDate) 
    : new Date(subscription.trialEndDate);

  const formattedDate = expiredDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const now = new Date();
  const daysRemaining = Math.ceil((expiredDate - now) / (1000 * 60 * 60 * 24));

  await sendEmail({
    to: owner.email,
    subject: `Action Required: Renew Your Smart POS Subscription`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #ea580c; margin-bottom: 20px;">POS Subscription Renewal Alert</h2>
        <p>Hello <strong>${owner.name}</strong>,</p>
        <p>This is a reminder that your subscription for <strong>${subscription.store.name}</strong> is expiring soon.</p>
        <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #9a3412; font-weight: bold;">
            Expiry Date: ${formattedDate} (${daysRemaining > 0 ? `${daysRemaining} days remaining` : "Expired"})
          </p>
          <p style="margin: 5px 0 0 0; font-size: 13px; color: #c2410c;">
            Plan level: ${subscription.plan || "Trial"}
          </p>
        </div>
        <p>To prevent any service interruptions or losing features, please log in to your account and renew your plan.</p>
        <div style="margin: 30px 0; text-align: center;">
          <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}/subscription" style="background-color: #ea580c; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Renew Subscription Now</a>
        </div>
        <p>If you have already processed your renewal, please ignore this notice.</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="font-size: 11px; color: #9ca3af; text-align: center;">Smart POS SaaS Inc. &bull; support@pos-platform.com</p>
      </div>
    `,
  });

  return { message: "Renewal reminder email sent successfully" };
}

export async function testSmtpConnectionService({ smtpHost, smtpPort, smtpUser, smtpPass }) {
  if (!smtpHost || !smtpUser || !smtpPass) {
    throw new Error("SMTP host, username, and password are required for verification");
  }

  const port = smtpPort ? parseInt(smtpPort.toString()) : 587;
  const { default: nodemailer } = await import("nodemailer");

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port,
    secure: port === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    connectionTimeout: 8000, // 8 seconds timeout
    greetingTimeout: 8000,
    socketTimeout: 8000,
  });

  await transporter.verify();
  return { success: true, message: "SMTP connection established successfully!" };
}
