/**
 * Migration Script: Add pointsRedemptionRate to POSSettings
 * This script updates existing settings to include the loyalty points redemption rate
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function migrateRedemptionRate() {
  try {
    console.log("🔄 Starting points redemption rate migration...");

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
          loyaltyPointsPerUnit: 10, // Default: 1 point per 10 currency units (earning)
          pointsRedemptionRate: 100, // Default: 100 points = 1 currency unit (redemption)
        },
      });

      console.log("✅ Default settings created:");
      console.log("   - Earning Rate: 1 point per 10 currency units spent");
      console.log("   - Redemption Rate: 100 points = 1 currency unit discount");
      return;
    }

    // Update each setting if pointsRedemptionRate doesn't exist or is 0
    for (const setting of settings) {
      const needsUpdate = !setting.pointsRedemptionRate || setting.pointsRedemptionRate === 0;

      if (needsUpdate) {
        await prisma.pOSSettings.update({
          where: { id: setting.id },
          data: { pointsRedemptionRate: 100 },
        });

        console.log(
          `✅ Updated setting ID ${setting.id}: Set redemption rate to 100 points = 1 ${setting.currencySymbol}`
        );
      } else {
        console.log(
          `ℹ️  Setting ID ${setting.id} already has redemption rate: ${setting.pointsRedemptionRate} points = 1 ${setting.currencySymbol}`
        );
      }
    }

    console.log("\n📊 Migration Summary:");
    console.log("=".repeat(60));

    const finalSettings = await prisma.pOSSettings.findMany();
    for (const setting of finalSettings) {
      console.log(`\n📍 Setting ID: ${setting.id}`);
      console.log(`   Currency: ${setting.currencyCode} (${setting.currencySymbol})`);
      console.log(`   📈 Earning: 1 point per ${setting.loyaltyPointsPerUnit} ${setting.currencySymbol} spent`);
      console.log(`   💰 Redemption: ${setting.pointsRedemptionRate} points = ${setting.currencySymbol}1 discount`);

      // Calculate example
      const spent100 = Math.floor(100 / setting.loyaltyPointsPerUnit);
      const discount = Math.floor(spent100 / setting.pointsRedemptionRate);
      console.log(
        `   📝 Example: Spend ${setting.currencySymbol}100 → Earn ${spent100} points → Redeem for ${
          setting.currencySymbol
        }${discount.toFixed(2)} discount`
      );
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Points redemption rate migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateRedemptionRate()
  .then(() => {
    console.log("\n🎉 All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Migration error:", error);
    process.exit(1);
  });
