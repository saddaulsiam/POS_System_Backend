/**
 * Migration Script: Add currencyCode to existing POSSettings
 * This script updates existing settings records to include currencyCode based on their currencySymbol
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Map symbols to currency codes
const symbolToCurrencyCode = {
  $: "USD",
  "৳": "BDT",
  "€": "EUR",
  "£": "GBP",
  "₹": "INR",
  "¥": "JPY",
};

async function migrateCurrencyCode() {
  try {
    console.log("🔄 Starting currency code migration...");

    // Get all existing settings
    const settings = await prisma.pOSSettings.findMany();

    if (settings.length === 0) {
      console.log("ℹ️  No existing settings found. Creating default settings...");

      await prisma.pOSSettings.create({
        data: {
          enableQuickSale: true,
          enableSplitPayment: true,
          enableParkSale: true,
          enableCustomerSearch: true,
          enableBarcodeScanner: true,
          enableLoyaltyPoints: true,
          taxRate: 0,
          currencyCode: "USD",
          currencySymbol: "$",
          currencyPosition: "before",
        },
      });

      console.log("✅ Default settings created with USD currency");
      return;
    }

    // Update each setting
    for (const setting of settings) {
      const currencyCode = symbolToCurrencyCode[setting.currencySymbol] || "USD";

      await prisma.pOSSettings.update({
        where: { id: setting.id },
        data: { currencyCode },
      });

      console.log(`✅ Updated setting ID ${setting.id}: ${setting.currencySymbol} → ${currencyCode}`);
    }

    console.log(`\n🎉 Migration complete! Updated ${settings.length} record(s).`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateCurrencyCode()
  .then(() => {
    console.log("\n✅ Migration script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration script failed:", error);
    process.exit(1);
  });
