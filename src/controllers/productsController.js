const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { upload, deleteImage } = require("../utils/upload");
const { parseCSV, jsonToCSV, validateProductImport } = require("../utils/csvHandler");
const {
  parseExcel,
  jsonToExcel,
  generateProductImportTemplate,
  validateProductExcelData,
} = require("../utils/excelHandler");
const { generateBarcode, generateBarcodeImage } = require("../utils/barcodeGenerator");

// ALERTS & NOTIFICATIONS LOGIC
async function checkAndCreateAlerts(productId) {
  const settings = await prisma.pOSSettings.findFirst();
  const product = await prisma.product.findUnique({ where: { id: productId } });

  // Low Stock Alert
  if (settings?.enableLowStockAlerts && product.stockQuantity <= settings.lowStockThreshold) {
    await prisma.notification.create({
      data: {
        type: "low_stock",
        message: `Stock for ${product.name} is low (${product.stockQuantity} left)`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // High Stock Alert
  if (settings?.enableHighStockAlerts && product.stockQuantity >= settings.highStockThreshold) {
    await prisma.notification.create({
      data: {
        type: "high_stock",
        message: `Stock for ${product.name} is high (${product.stockQuantity} units)`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Expiry Alert
  if (settings?.enableProductExpiryAlerts && product.expiryDate && new Date(product.expiryDate) < new Date()) {
    await prisma.notification.create({
      data: {
        type: "expiry",
        message: `Product ${product.name} has expired.`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Inactive Product Alert
  if (
    settings?.inactiveProductAlertEnabled &&
    product.lastSoldDate &&
    (new Date() - new Date(product.lastSoldDate)) / (1000 * 60 * 60 * 24) > settings.inactiveProductDays
  ) {
    await prisma.notification.create({
      data: {
        type: "inactive",
        message: `Product ${product.name} has not been sold for ${settings.inactiveProductDays} days.`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // System Error Alert
  if (settings?.systemErrorAlertEnabled && product.hasError) {
    await prisma.notification.create({
      data: {
        type: "system_error",
        message: `System error detected for product ${product.name}.`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Price Change Alert
  if (settings?.priceChangeAlertEnabled && product.priceChanged) {
    await prisma.notification.create({
      data: {
        type: "price_change",
        message: `Price changed for product ${product.name}.`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Supplier Delivery Alert
  if (settings?.supplierDeliveryAlertEnabled && product.expectedDeliveryDate) {
    const daysUntilDelivery = (new Date(product.expectedDeliveryDate) - new Date()) / (1000 * 60 * 60 * 24);
    if (daysUntilDelivery < settings.expectedDeliveryDays) {
      await prisma.notification.create({
        data: {
          type: "supplier_delivery",
          message: `Supplier delivery for ${product.name} expected in ${Math.ceil(daysUntilDelivery)} days.`,
          productId: product.id,
          isRead: false,
        },
      });
    }
  }

  // Low Balance Alert
  if (
    settings?.lowBalanceAlertEnabled &&
    product.balance !== undefined &&
    product.balance < settings.lowBalanceThreshold
  ) {
    await prisma.notification.create({
      data: {
        type: "low_balance",
        message: `Balance for ${product.name} is low (${product.balance}).`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Frequent Refunds Alert
  if (
    settings?.frequentRefundsAlertEnabled &&
    product.refundCount !== undefined &&
    product.refundCount > settings.frequentRefundsThreshold
  ) {
    await prisma.notification.create({
      data: {
        type: "frequent_refunds",
        message: `Frequent refunds for ${product.name} (${product.refundCount} times).`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Daily Sales Target Alert
  if (
    settings?.dailySalesTargetAlertEnabled &&
    product.dailySales !== undefined &&
    product.dailySales < settings.dailySalesTargetAmount
  ) {
    await prisma.notification.create({
      data: {
        type: "daily_sales_target",
        message: `Daily sales for ${product.name} below target (${product.dailySales}/${settings.dailySalesTargetAmount}).`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Loyalty Points Expiry Alert
  if (
    settings?.loyaltyPointsExpiryAlertEnabled &&
    product.loyaltyPointsExpiryDate &&
    new Date(product.loyaltyPointsExpiryDate) < new Date()
  ) {
    await prisma.notification.create({
      data: {
        type: "loyalty_points_expiry",
        message: `Loyalty points for ${product.name} have expired.`,
        productId: product.id,
        isRead: false,
      },
    });
  }
}

module.exports = {
  checkAndCreateAlerts,
  // Add other product controller functions here
};
