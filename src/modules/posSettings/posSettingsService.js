import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getSettings = async (storeId) => {
  let settings = await prisma.pOSSettings.findFirst({
    where: { storeId },
    include: {
      updatedByEmployee: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  });
  if (!settings) {
    settings = await prisma.pOSSettings.create({
      data: {
        storeId,
        enableQuickSale: true,
        enableSplitPayment: true,
        enableParkSale: true,
        enableCustomerSearch: true,
        enableBarcodeScanner: true,
        enableLoyaltyPoints: true,
        taxRate: 0,
      },
    });
  }
  return settings;
};

export const updateSettings = async (body, userId, storeId) => {
  const updateData = {};
  const allowedFields = [
    "enableQuickSale",
    "enableSplitPayment",
    "enableParkSale",
    "enableCustomerSearch",
    "enableBarcodeScanner",
    "enableLoyaltyPoints",
    "loyaltyPointsPerUnit",
    "pointsRedemptionRate",
    "storeName",
    "storeAddress",
    "storePhone",
    "storeEmail",
    "taxId",
    "taxRate",
    "currencyCode",
    "currencySymbol",
    "currencyPosition",
    "receiptFooterText",
    "returnPolicy",
    "printReceiptAuto",
    "emailReceiptAuto",
    "autoPrintThermal",
    "enableLowStockAlerts",
    "lowStockThreshold",
    "enableHighStockAlerts",
    "highStockThreshold",
    "enableProductExpiryAlerts",
    "productExpiryDays",
    "enableEmailNotifications",
    "adminAlertEmail",
    "dailySalesTargetAlertEnabled",
    "dailySalesTargetAmount",
    "priceChangeAlertEnabled",
    "supplierDeliveryAlertEnabled",
    "expectedDeliveryDays",
    "inactiveProductAlertEnabled",
    "inactiveProductDays",
    "lowBalanceAlertEnabled",
    "lowBalanceThreshold",
    "frequentRefundsAlertEnabled",
    "frequentRefundsThreshold",
    "loyaltyPointsExpiryAlertEnabled",
    "loyaltyPointsExpiryDays",
    "systemErrorAlertEnabled",
    "autoLogoutMinutes",
    "requirePasswordOnVoid",
    "enableAuditLog",
    "productsPerPage",
    "defaultView",
    "showProductImages",
  ];
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  });
  updateData.updatedBy = userId;
  let settings = await prisma.pOSSettings.findFirst({ where: { storeId } });
  if (!settings) {
    settings = await prisma.pOSSettings.create({
      data: {
        ...updateData,
        storeId,
        enableQuickSale: updateData.enableQuickSale ?? true,
        enableSplitPayment: updateData.enableSplitPayment ?? true,
        enableParkSale: updateData.enableParkSale ?? true,
        enableCustomerSearch: updateData.enableCustomerSearch ?? true,
        enableBarcodeScanner: updateData.enableBarcodeScanner ?? true,
        enableLoyaltyPoints: updateData.enableLoyaltyPoints ?? true,
        taxRate: updateData.taxRate ?? 0,
      },
      include: {
        updatedByEmployee: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });
  } else {
    settings = await prisma.pOSSettings.update({
      where: { id: settings.id, storeId },
      data: updateData,
      include: {
        updatedByEmployee: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });
  }
  return settings;
};
