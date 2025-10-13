import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Get All notifications
export async function getNotificationsService() {
  return await prisma.notification.findMany({
    where: { productId: { not: null } },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: { id: true, name: true, sku: true },
      },
    },
  });
}

// Mark notification as read
export async function markNotificationAsReadService(id) {
  await prisma.notification.update({ where: { id: parseInt(id) }, data: { isRead: true } });
}

// Delete notification
export async function deleteNotificationService(id) {
  await prisma.notification.delete({ where: { id: parseInt(id) } });
}

// Alerts for product status changes
export async function checkAndCreateAlerts(productId) {
  if (!productId || isNaN(productId)) {
    // Don't run alerts if productId is missing or invalid
    return;
  }
  const settings = await prisma.pOSSettings.findFirst();
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    // Optionally log or notify about missing product
    return;
  }

  // Low Stock Alert
  if (settings?.enableLowStockAlerts && product.stockQuantity <= settings.lowStockThreshold) {
    try {
      await prisma.notification.create({
        data: {
          type: "low_stock",
          message: `Stock for ${product.name} is low (${product.stockQuantity} left)`,
          productId: product.id,
          isRead: false,
        },
      });
    } catch (err) {
      console.error("Failed to create low stock notification:", err);
    }
  }

  // High Stock Alert
  if (settings?.enableHighStockAlerts && product.stockQuantity >= settings.highStockThreshold) {
    try {
      await prisma.notification.create({
        data: {
          type: "high_stock",
          message: `Stock for ${product.name} is high (${product.stockQuantity} units)`,
          productId: product.id,
          isRead: false,
        },
      });
    } catch (err) {
      console.error("Failed to create high stock notification:", err);
    }
  }

  // Expiry Alert
  if (settings?.enableProductExpiryAlerts && product.expiryDate && new Date(product.expiryDate) < new Date()) {
    try {
      await prisma.notification.create({
        data: {
          type: "expiry",
          message: `Product ${product.name} has expired.`,
          productId: product.id,
          isRead: false,
        },
      });
    } catch (err) {
      console.error("Failed to create expiry notification:", err);
    }
  }

  // Inactive Product Alert
  if (
    settings?.inactiveProductAlertEnabled &&
    product.lastSoldDate &&
    (new Date() - new Date(product.lastSoldDate)) / (1000 * 60 * 60 * 24) > settings.inactiveProductDays
  ) {
    try {
      await prisma.notification.create({
        data: {
          type: "inactive",
          message: `Product ${product.name} has not been sold for ${settings.inactiveProductDays} days.`,
          productId: product.id,
          isRead: false,
        },
      });
    } catch (err) {
      console.error("Failed to create inactive product notification:", err);
    }
  }

  // System Error Alert
  if (settings?.systemErrorAlertEnabled && product.hasError) {
    try {
      await prisma.notification.create({
        data: {
          type: "system_error",
          message: `System error detected for product ${product.name}.`,
          productId: product.id,
          isRead: false,
        },
      });
    } catch (err) {
      console.error("Failed to create system error notification:", err);
    }
  }

  // Price Change Alert
  if (settings?.priceChangeAlertEnabled && product.priceChanged) {
    try {
      await prisma.notification.create({
        data: {
          type: "price_change",
          message: `Price changed for product ${product.name}.`,
          productId: product.id,
          isRead: false,
        },
      });
    } catch (err) {
      console.error("Failed to create price change notification:", err);
    }
  }

  // Supplier Delivery Alert
  if (settings?.supplierDeliveryAlertEnabled && product.expectedDeliveryDate) {
    const daysUntilDelivery = (new Date(product.expectedDeliveryDate) - new Date()) / (1000 * 60 * 60 * 24);
    if (daysUntilDelivery < settings.expectedDeliveryDays) {
      try {
        await prisma.notification.create({
          data: {
            type: "supplier_delivery",
            message: `Supplier delivery for ${product.name} expected in ${Math.ceil(daysUntilDelivery)} days.`,
            productId: product.id,
            isRead: false,
          },
        });
      } catch (err) {
        console.error("Failed to create supplier delivery notification:", err);
      }
    }
  }

  // Low Balance Alert
  if (
    settings?.lowBalanceAlertEnabled &&
    product.balance !== undefined &&
    product.balance < settings.lowBalanceThreshold
  ) {
    try {
      await prisma.notification.create({
        data: {
          type: "low_balance",
          message: `Balance for ${product.name} is low (${product.balance}).`,
          productId: product.id,
          isRead: false,
        },
      });
    } catch (err) {
      console.error("Failed to create low balance notification:", err);
    }
  }

  // Frequent Refunds Alert
  if (
    settings?.frequentRefundsAlertEnabled &&
    product.refundCount !== undefined &&
    product.refundCount > settings.frequentRefundsThreshold
  ) {
    try {
      await prisma.notification.create({
        data: {
          type: "frequent_refunds",
          message: `Frequent refunds for ${product.name} (${product.refundCount} times).`,
          productId: product.id,
          isRead: false,
        },
      });
    } catch (err) {
      console.error("Failed to create frequent refunds notification:", err);
    }
  }

  // Daily Sales Target Alert
  if (
    settings?.dailySalesTargetAlertEnabled &&
    product.dailySales !== undefined &&
    product.dailySales < settings.dailySalesTargetAmount
  ) {
    try {
      await prisma.notification.create({
        data: {
          type: "daily_sales_target",
          message: `Daily sales for ${product.name} below target (${product.dailySales}/${settings.dailySalesTargetAmount}).`,
          productId: product.id,
          isRead: false,
        },
      });
    } catch (err) {
      console.error("Failed to create daily sales target notification:", err);
    }
  }

  // Loyalty Points Expiry Alert
  if (
    settings?.loyaltyPointsExpiryAlertEnabled &&
    product.loyaltyPointsExpiryDate &&
    new Date(product.loyaltyPointsExpiryDate) < new Date()
  ) {
    try {
      await prisma.notification.create({
        data: {
          type: "loyalty_points_expiry",
          message: `Loyalty points for ${product.name} have expired.`,
          productId: product.id,
          isRead: false,
        },
      });
    } catch (err) {
      console.error("Failed to create loyalty points expiry notification:", err);
    }
  }
}
