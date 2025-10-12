import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function getAll(query) {
  // Fetch all cash drawers with optional pagination and filters
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
    }),
    prisma.cashDrawer.count({ where }),
  ]);
  return { cashDrawers, total, page: Number(page), limit: Number(limit) };
}

async function getCurrent(user) {
  // Get current open drawer for the logged-in employee
  return await prisma.cashDrawer.findFirst({
    where: {
      employeeId: user.id,
      status: "OPEN",
    },
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
      openingAmount: body.openingAmount,
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
      closingAmount: body.closingAmount,
      closedAt: new Date(),
      status: "CLOSED",
      notes: body.notes || null,
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
  // Example: fetch transactions, calculate expected vs actual
  const drawer = await prisma.cashDrawer.findUnique({ where: { id: Number(id) } });
  if (!drawer) throw new Error("Cash drawer not found.");
  // Assume transactions are linked to drawerId
  const transactions = await prisma.transaction.findMany({ where: { drawerId: Number(id) } });
  const expectedTotal = drawer.openingAmount + transactions.reduce((sum, t) => sum + t.amount, 0);
  return {
    drawer,
    transactions,
    expectedTotal,
    actualTotal: drawer.closingAmount || null,
    discrepancy: drawer.closingAmount ? drawer.closingAmount - expectedTotal : null,
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
    (d) => d.closingAmount !== null && d.openingAmount !== null && d.closingAmount !== d.openingAmount
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
