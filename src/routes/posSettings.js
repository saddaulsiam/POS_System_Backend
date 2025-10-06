const express = require("express");
const { body, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Get POS settings (Anyone authenticated can read)
router.get("/", [authenticateToken], async (req, res) => {
  try {
    // Get the first (and should be only) settings record
    let settings = await prisma.pOSSettings.findFirst({
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

    // If no settings exist, create default ones
    if (!settings) {
      settings = await prisma.pOSSettings.create({
        data: {
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
    res.json(settings);
  } catch (error) {
    console.error("Get POS settings error:", error);
    res.status(500).json({ error: "Failed to fetch POS settings" });
  }
});

// Update POS settings (Admin only)
router.put(
  "/",
  [
    authenticateToken,
    authorizeRoles("ADMIN"),
    // Feature Toggles
    body("enableQuickSale").optional().isBoolean(),
    body("enableSplitPayment").optional().isBoolean(),
    body("enableParkSale").optional().isBoolean(),
    body("enableCustomerSearch").optional().isBoolean(),
    body("enableBarcodeScanner").optional().isBoolean(),
    body("enableLoyaltyPoints").optional().isBoolean(),
    body("loyaltyPointsPerUnit").optional().isFloat({ min: 0.01 }),
    body("pointsRedemptionRate").optional().isFloat({ min: 1 }),
    // Store Information
    body("storeName").optional().isString(),
    body("storeAddress").optional().isString(),
    body("storePhone").optional().isString(),
    body("storeEmail").optional().isEmail(),
    body("taxId").optional().isString(),
    // Tax & Currency
    body("taxRate").optional().isFloat({ min: 0, max: 100 }),
    body("currencyCode").optional().isString(),
    body("currencySymbol").optional().isString(),
    body("currencyPosition").optional().isIn(["before", "after"]),
    // Receipt Settings
    body("receiptFooterText").optional().isString(),
    body("returnPolicy").optional().isString(),
    body("printReceiptAuto").optional().isBoolean(),
    body("emailReceiptAuto").optional().isBoolean(),
    body("autoPrintThermal").optional().isBoolean(),
    // Alerts & Notifications
    body("enableLowStockAlerts").optional().isBoolean(),
    body("lowStockThreshold").optional().isInt({ min: 1, max: 1000 }),
    body("enableHighStockAlerts").optional().isBoolean(),
    body("highStockThreshold").optional().isInt({ min: 10, max: 10000 }),
    body("enableProductExpiryAlerts").optional().isBoolean(),
    body("productExpiryDays").optional().isInt({ min: 1, max: 365 }),
    body("enableEmailNotifications").optional().isBoolean(),
    body("adminAlertEmail").optional().isEmail(),
    // Daily Sales Target Alert
    body("dailySalesTargetAlertEnabled").optional().isBoolean(),
    body("dailySalesTargetAmount").optional().isInt({ min: 1 }),
    // Price Change Alert
    body("priceChangeAlertEnabled").optional().isBoolean(),
    // Supplier Delivery Alert
    body("supplierDeliveryAlertEnabled").optional().isBoolean(),
    body("expectedDeliveryDays").optional().isInt({ min: 1, max: 60 }),
    // Inactive Product Alert
    body("inactiveProductAlertEnabled").optional().isBoolean(),
    body("inactiveProductDays").optional().isInt({ min: 1, max: 365 }),
    // Low Balance Alert
    body("lowBalanceAlertEnabled").optional().isBoolean(),
    body("lowBalanceThreshold").optional().isFloat({ min: 0 }),
    // Frequent Refunds Alert
    body("frequentRefundsAlertEnabled").optional().isBoolean(),
    body("frequentRefundsThreshold").optional().isInt({ min: 1 }),
    // Loyalty Points Expiry Alert
    body("loyaltyPointsExpiryAlertEnabled").optional().isBoolean(),
    body("loyaltyPointsExpiryDays").optional().isInt({ min: 1 }),
    // System Settings
    body("autoLogoutMinutes").optional().isInt({ min: 5, max: 240 }),
    body("requirePasswordOnVoid").optional().isBoolean(),
    body("enableAuditLog").optional().isBoolean(),
    body("productsPerPage").optional().isInt({ min: 10, max: 100 }),
    body("defaultView").optional().isIn(["grid", "list"]),
    body("showProductImages").optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updateData = {};
      // Map all possible fields from request body
      const allowedFields = [
        // Feature Toggles
        "enableQuickSale",
        "enableSplitPayment",
        "enableParkSale",
        "enableCustomerSearch",
        "enableBarcodeScanner",
        "enableLoyaltyPoints",
        "loyaltyPointsPerUnit",
        "pointsRedemptionRate",
        // Store Information
        "storeName",
        "storeAddress",
        "storePhone",
        "storeEmail",
        "taxId",
        // Tax & Currency
        "taxRate",
        "currencyCode",
        "currencySymbol",
        "currencyPosition",
        // Receipt Settings
        "receiptFooterText",
        "returnPolicy",
        "printReceiptAuto",
        "emailReceiptAuto",
        "autoPrintThermal",
        // Alerts & Notifications
        "enableLowStockAlerts",
        "lowStockThreshold",
        "enableHighStockAlerts",
        "highStockThreshold",
        "enableProductExpiryAlerts",
        "productExpiryDays",
        "enableEmailNotifications",
        "adminAlertEmail",
        // Daily Sales Target Alert
        "dailySalesTargetAlertEnabled",
        "dailySalesTargetAmount",
        // Price Change Alert
        "priceChangeAlertEnabled",
        // Supplier Delivery Alert
        "supplierDeliveryAlertEnabled",
        "expectedDeliveryDays",
        // Inactive Product Alert
        "inactiveProductAlertEnabled",
        "inactiveProductDays",
        // Low Balance Alert
        "lowBalanceAlertEnabled",
        "lowBalanceThreshold",
        // Frequent Refunds Alert
        "frequentRefundsAlertEnabled",
        "frequentRefundsThreshold",
        // Loyalty Points Expiry Alert
        "loyaltyPointsExpiryAlertEnabled",
        "loyaltyPointsExpiryDays",
        // System Error/Failure Alert
        "systemErrorAlertEnabled",
        // System Settings
        "autoLogoutMinutes",
        "requirePasswordOnVoid",
        "enableAuditLog",
        "productsPerPage",
        "defaultView",
        "showProductImages",
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      });

      updateData.updatedBy = req.user.id;

      // Get existing settings or create if not exists
      let settings = await prisma.pOSSettings.findFirst();

      if (!settings) {
        // Create new settings
        settings = await prisma.pOSSettings.create({
          data: {
            ...updateData,
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
        // Update existing settings
        settings = await prisma.pOSSettings.update({
          where: { id: settings.id },
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

      res.json(settings);
    } catch (error) {
      console.error("Update POS settings error:", error);
      res.status(500).json({ error: "Failed to update POS settings" });
    }
  }
);

module.exports = router;
