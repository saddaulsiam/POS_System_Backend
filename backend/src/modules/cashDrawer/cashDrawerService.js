import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function getAll(query) {
  const { page = 1, limit = 20, status, employeeId } = query;
  const where = {};
  if (status) where.status = status;
  if (employeeId) where.employeeId = Number(employeeId);
  const skip = (Number(page) - 1) * Number(limit);
  const [cashDrawers, total] = await Promise.all([
    prisma.cashDrawer.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { openedAt: "desc" },
      include: { employee: true },
    }),
    prisma.cashDrawer.count({ where }),
  ]);
  const cashDrawersWithDifference = cashDrawers.map((drawer) => ({
    ...drawer,
    difference:
      drawer.closingBalance !== null && drawer.openingBalance !== null
        ? drawer.closingBalance - drawer.openingBalance
        : null,
  }));
  return {
    cashDrawers: cashDrawersWithDifference,
    total,
    page: Number(page),
    limit: Number(limit),
    pagination: {
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
      total,
    },
  };
}

async function getCurrent(user) {
  // Get current open drawer for the logged-in employee
  return await prisma.cashDrawer.findFirst({
    where: {
      employeeId: user.id,
      status: "OPEN",
    },
    include: { employee: true },
    orderBy: { openedAt: "desc" },
  });
}

async function openDrawer(user, body) {
  // Open a new cash drawer for the employee
  // Only allow if no open drawer exists
  const existing = await prisma.cashDrawer.findFirst({
    where: {
      employeeId: user.id,
      status: "OPEN",
    },
  });
  if (existing) throw new Error("An open cash drawer already exists for this employee.");
  return await prisma.cashDrawer.create({
    data: {
      employeeId: user.id,
      openingBalance: body.openingBalance,
      openedAt: new Date(),
      status: "OPEN",
    },
  });
}

async function closeDrawer(user, params, body) {
  // Close the specified cash drawer
  const { id } = params;
  const drawer = await prisma.cashDrawer.findUnique({ where: { id: Number(id) } });
  if (!drawer || drawer.status !== "OPEN") throw new Error("Cash drawer not found or not open.");
  if (drawer.employeeId !== user.id) throw new Error("Unauthorized to close this drawer.");
  return await prisma.cashDrawer.update({
    where: { id: Number(id) },
    data: {
      closingBalance: body.closingBalance,
      closedAt: new Date(),
      status: "CLOSED",
    },
  });
}

async function getById(user, params) {
  // Fetch cash drawer by ID
  const { id } = params;
  const drawer = await prisma.cashDrawer.findUnique({ where: { id: Number(id) } });
  if (!drawer) throw new Error("Cash drawer not found.");
  // Optionally restrict access by employee or role
  return drawer;
}

async function getReconciliation(user, params) {
  // Fetch reconciliation details for a drawer
  const { id } = params;
  const drawer = await prisma.cashDrawer.findUnique({ where: { id: Number(id) } });
  if (!drawer) throw new Error("Cash drawer not found.");

  // Fetch sales for this employee during the drawer's shift
  const sales = await prisma.sale.findMany({
    where: {
      employeeId: drawer.employeeId,
      createdAt: {
        gte: drawer.openedAt,
        lte: drawer.closedAt ?? new Date(),
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate totals and payment breakdown
  const totalSales = sales.reduce((sum, sale) => sum + sale.finalAmount, 0);
  const paymentBreakdown = {
    cash: sales.filter((s) => s.paymentMethod === "CASH").reduce((sum, s) => sum + s.finalAmount, 0),
    card: sales.filter((s) => s.paymentMethod === "CARD").reduce((sum, s) => sum + s.finalAmount, 0),
    mobile: sales.filter((s) => s.paymentMethod === "MOBILE").reduce((sum, s) => sum + s.finalAmount, 0),
    other: sales
      .filter((s) => !["CASH", "CARD", "MOBILE"].includes(s.paymentMethod))
      .reduce((sum, s) => sum + s.finalAmount, 0),
  };

  // Expected cash balance = openingBalance + cash sales
  const expectedCashBalance = drawer.openingBalance + paymentBreakdown.cash;

  // Recent transactions (last 5 sales)
  const recentTransactions = sales.slice(0, 5).map((sale) => ({
    receiptId: sale.receiptId,
    finalAmount: sale.finalAmount,
    paymentMethod: sale.paymentMethod,
    createdAt: sale.createdAt,
  }));

  return {
    drawer,
    sales: sales.length,
    totalSales,
    paymentBreakdown,
    expectedCashBalance,
    actualBalance: drawer.closingBalance || null,
    difference: drawer.closingBalance !== null ? drawer.closingBalance - expectedCashBalance : null,
    recentTransactions,
  };
}

async function getSummary(query) {
  // Fetch summary statistics for cash drawers
  // Example: total opened, closed, discrepancies
  const totalOpened = await prisma.cashDrawer.count({ where: { status: "OPEN" } });
  const totalClosed = await prisma.cashDrawer.count({ where: { status: "CLOSED" } });
  const totalDrawers = await prisma.cashDrawer.count();
  // Discrepancy: count drawers with nonzero discrepancy
  const drawers = await prisma.cashDrawer.findMany({ where: { status: "CLOSED" } });
  const discrepancies = drawers.filter(
    (d) => d.closingBalance !== null && d.openingBalance !== null && d.closingBalance !== d.openingBalance
  ).length;
  return {
    totalOpened,
    totalClosed,
    totalDrawers,
    discrepancies,
  };
}

export const cashDrawerService = {
  getAll,
  getCurrent,
  openDrawer,
  closeDrawer,
  getById,
  getReconciliation,
  getSummary,
};
