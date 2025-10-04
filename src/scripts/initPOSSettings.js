const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function initPOSSettings() {
  try {
    console.log("Checking for POSSettings...");

    // Check if settings already exist
    const existing = await prisma.pOSSettings.findFirst();

    if (existing) {
      console.log("✓ POSSettings already exist");
      console.log(`  Store Name: ${existing.storeName}`);
      console.log(`  Updated: ${existing.updatedAt}`);
      return;
    }

    console.log("Creating default POSSettings...");

    const settings = await prisma.pOSSettings.create({
      data: {
        enableQuickSale: true,
        enableSplitPayment: true,
        enableParkSale: true,
        enableCustomerSearch: true,
        enableBarcodeScanner: true,
        enableLoyaltyPoints: true,
        storeName: "Fresh Mart Grocery",
        storeAddress: "123 Market Street, Shopping District, City, State 12345",
        storePhone: "(555) 123-4567",
        storeEmail: "info@freshmart.com",
        taxId: "TAX-123456789",
        taxRate: 8.25,
        currencySymbol: "$",
        currencyPosition: "before",
        receiptFooterText: "Thank you for shopping with us! Visit again soon.",
        returnPolicy: "Returns accepted within 30 days with receipt in original condition.",
        printReceiptAuto: false,
        emailReceiptAuto: false,
        enableLowStockAlerts: true,
        lowStockThreshold: 10,
        enableEmailNotifications: true,
        adminAlertEmail: "admin@freshmart.com",
        autoLogoutMinutes: 30,
        requirePasswordOnVoid: true,
        enableAuditLog: true,
        productsPerPage: 20,
        defaultView: "grid",
        showProductImages: true,
        updatedBy: 1, // Admin user
      },
    });

    console.log("✓ POSSettings created successfully!");
    console.log(`  ID: ${settings.id}`);
    console.log(`  Store: ${settings.storeName}`);
    console.log(
      `  All features enabled: ${settings.enableQuickSale && settings.enableSplitPayment && settings.enableParkSale}`
    );
  } catch (error) {
    console.error("Error initializing POSSettings:", error);
  } finally {
    await prisma.$disconnect();
  }
}

initPOSSettings();
