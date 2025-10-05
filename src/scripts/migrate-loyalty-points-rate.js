/**
 * Migration Script: Add loyaltyPointsPerUnit to POSSettings
 * This script updates existing settings to include the loyalty points earning rate
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function migrateLoyaltyPointsRate() {
  try {
    console.log("🔄 Starting loyalty points rate migration...");

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
          loyaltyPointsPerUnit: 10, // Default: 1 point per 10 currency units
        },
      });

      console.log("✅ Default settings created with loyalty points rate: 1 point per 10 units");
      return;
    }

    // Update each setting if loyaltyPointsPerUnit doesn't exist or is 0
    for (const setting of settings) {
      const needsUpdate = !setting.loyaltyPointsPerUnit || setting.loyaltyPointsPerUnit === 0;

      if (needsUpdate) {
        await prisma.pOSSettings.update({
          where: { id: setting.id },
          data: { loyaltyPointsPerUnit: 10 },
        });

        console.log(
          `✅ Updated setting ID ${setting.id}: Set loyalty points rate to 1 point per 10 ${setting.currencySymbol}`
        );
      } else {
        console.log(`ℹ️  Setting ID ${setting.id}: Already has loyalty points rate (${setting.loyaltyPointsPerUnit})`);
      }
    }

    console.log(`\n🎉 Migration complete! Updated ${settings.length} record(s).`);

    // Display summary
    const updatedSettings = await prisma.pOSSettings.findFirst();
    if (updatedSettings) {
      console.log(`\n📊 Current Configuration:`);
      console.log(`   Currency: ${updatedSettings.currencyCode} (${updatedSettings.currencySymbol})`);
      console.log(
        `   Loyalty Points Rate: 1 point per ${updatedSettings.loyaltyPointsPerUnit} ${updatedSettings.currencySymbol}`
      );
      console.log(
        `   Example: Spend ${updatedSettings.currencySymbol}${
          updatedSettings.loyaltyPointsPerUnit * 10
        } → Earn 10 points`
      );
    }
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateLoyaltyPointsRate()
  .then(() => {
    console.log("\n✅ Migration script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration script failed:", error);
    process.exit(1);
  });
