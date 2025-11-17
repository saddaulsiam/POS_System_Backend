import prisma from "../../prisma.js";

export async function getAllParkedSalesService(employeeId, storeId) {
  const parkedSales = await prisma.parkedSale.findMany({
    where: { employeeId, storeId },
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
  storeId,
}) {
  const itemsJSON = JSON.stringify(items);
  const parkedSale = await prisma.parkedSale.create({
    data: {
      employeeId,
      customerId,
      storeId,
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

export async function getParkedSaleService(id, employeeId, storeId) {
  const parkedSale = await prisma.parkedSale.findFirst({
    where: { id, employeeId, storeId },
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

export async function deleteParkedSaleService(id, employeeId, storeId) {
  const parkedSale = await prisma.parkedSale.findFirst({ where: { id, employeeId, storeId } });
  if (!parkedSale) return null;
  await prisma.parkedSale.delete({ where: { id, storeId } });
  return true;
}

export async function cleanupExpiredParkedSalesService(storeId) {
  const now = new Date();
  return prisma.parkedSale.deleteMany({
    where: {
      storeId,
      expiresAt: {
        lte: now,
      },
    },
  });
}
