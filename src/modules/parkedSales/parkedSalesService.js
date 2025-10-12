import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function getAllParkedSalesService(employeeId) {
  const parkedSales = await prisma.parkedSale.findMany({
    where: { employeeId },
    include: {
      customer: true,
      employee: true,
    },
    orderBy: { parkedAt: "desc" },
  });
  return parkedSales.map((sale) => ({
    ...sale,
    items: JSON.parse(sale.items),
  }));
}

export async function parkSaleService({
  items,
  subtotal,
  taxAmount,
  discountAmount,
  customerId,
  notes,
  expiresAt,
  employeeId,
}) {
  const itemsJSON = JSON.stringify(items);
  const parkedSale = await prisma.parkedSale.create({
    data: {
      employeeId,
      customerId,
      items: itemsJSON,
      subtotal,
      taxAmount: taxAmount || 0,
      discountAmount: discountAmount || 0,
      notes,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    include: {
      customer: true,
      employee: true,
    },
  });
  return {
    ...parkedSale,
    items: JSON.parse(parkedSale.items),
  };
}

export async function getParkedSaleService(id, employeeId) {
  const parkedSale = await prisma.parkedSale.findFirst({
    where: { id, employeeId },
    include: {
      customer: true,
      employee: true,
    },
  });
  if (!parkedSale) return null;
  return {
    ...parkedSale,
    items: JSON.parse(parkedSale.items),
  };
}

export async function deleteParkedSaleService(id, employeeId) {
  const parkedSale = await prisma.parkedSale.findFirst({ where: { id, employeeId } });
  if (!parkedSale) return null;
  await prisma.parkedSale.delete({ where: { id } });
  return true;
}

export async function cleanupExpiredParkedSalesService() {
  const now = new Date();
  return prisma.parkedSale.deleteMany({
    where: {
      expiresAt: {
        lte: now,
      },
    },
  });
}
