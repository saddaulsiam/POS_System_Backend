import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function getStoreSettings(storeId) {
  const settings = await prisma.pOSSettings.findFirst({ where: { storeId } });
  if (settings) {
    return {
      storeName: settings.storeName,
      storeAddress: settings.storeAddress,
      storePhone: settings.storePhone,
      storeEmail: settings.storeEmail,
      taxId: settings.taxId,
      returnPolicy: settings.returnPolicy,
      receiptFooterText: settings.receiptFooterText,
      taxRate: settings.taxRate,
      currencyCode: settings.currencyCode,
      currencySymbol: settings.currencySymbol,
      currencyPosition: settings.currencyPosition,
    };
  }
  return {
    storeName: "POS System",
    storeAddress: "123 Business Avenue, Suite 100, City, State 12345",
    storePhone: "(555) 123-4567",
    storeEmail: "info@possystem.com",
    taxId: "TAX-123456789",
    returnPolicy: "Items may be returned within 30 days with receipt. Store credit only for items without receipt.",
  };
}

export async function getSaleData(saleId, storeId) {
  const sale = await prisma.sale.findFirst({
    where: { id: parseInt(saleId), storeId },
    include: {
      saleItems: { include: { product: true, productVariant: true } },
      customer: true,
      employee: { select: { id: true, name: true, username: true } },
      paymentSplits: true,
    },
  });
  if (!sale) throw new Error("Sale not found");
  return sale;
}
