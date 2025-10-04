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
    body("enableQuickSale").optional().isBoolean(),
    body("enableSplitPayment").optional().isBoolean(),
    body("enableParkSale").optional().isBoolean(),
    body("enableCustomerSearch").optional().isBoolean(),
    body("enableBarcodeScanner").optional().isBoolean(),
    body("enableLoyaltyPoints").optional().isBoolean(),
    body("taxRate").optional().isFloat({ min: 0, max: 100 }),
    body("receiptFooterText").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        enableQuickSale,
        enableSplitPayment,
        enableParkSale,
        enableCustomerSearch,
        enableBarcodeScanner,
        enableLoyaltyPoints,
        taxRate,
        receiptFooterText,
      } = req.body;

      const updateData = {};
      if (enableQuickSale !== undefined) updateData.enableQuickSale = enableQuickSale;
      if (enableSplitPayment !== undefined) updateData.enableSplitPayment = enableSplitPayment;
      if (enableParkSale !== undefined) updateData.enableParkSale = enableParkSale;
      if (enableCustomerSearch !== undefined) updateData.enableCustomerSearch = enableCustomerSearch;
      if (enableBarcodeScanner !== undefined) updateData.enableBarcodeScanner = enableBarcodeScanner;
      if (enableLoyaltyPoints !== undefined) updateData.enableLoyaltyPoints = enableLoyaltyPoints;
      if (taxRate !== undefined) updateData.taxRate = taxRate;
      if (receiptFooterText !== undefined) updateData.receiptFooterText = receiptFooterText;
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
