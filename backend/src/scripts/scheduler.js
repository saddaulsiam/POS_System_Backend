/**
 * Birthday Rewards Automation Scheduler
 * Automatically awards birthday bonuses to customers daily
 */

const cron = require("node-cron");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Tier birthday bonuses (same as in loyalty.js)
const LOYALTY_TIERS = {
  BRONZE: { birthdayBonus: 50 },
  SILVER: { birthdayBonus: 100 },
  GOLD: { birthdayBonus: 200 },
  PLATINUM: { birthdayBonus: 500 },
};

/**
 * Process birthday rewards for all customers with birthdays today
 */
async function processBirthdayRewards() {
  try {
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // JavaScript months are 0-based
    const todayDay = today.getDate();

    console.log(`\n🎂 Checking for birthdays on ${todayMonth}/${todayDay}/${today.getFullYear()}...`);

    // Get all active customers with birthdays
    const allCustomers = await prisma.customer.findMany({
      where: {
        isActive: true,
        dateOfBirth: { not: null },
      },
    });

    // Filter in JavaScript to handle timezone issues
    const customers = allCustomers.filter((customer) => {
      const birthDate = new Date(customer.dateOfBirth);
      return birthDate.getMonth() + 1 === todayMonth && birthDate.getDate() === todayDay;
    });

    if (customers.length === 0) {
      console.log("✅ No birthdays today - all clear!");
      return {
        success: true,
        count: 0,
        customers: [],
      };
    }

    console.log(`🎉 Found ${customers.length} birthday${customers.length > 1 ? "s" : ""} today!`);

    const results = [];

    // Process each birthday customer
    for (const customer of customers) {
      try {
        // Check if birthday bonus already awarded today
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        const existingBonus = await prisma.pointsTransaction.findFirst({
          where: {
            customerId: customer.id,
            type: "BIRTHDAY_BONUS",
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });

        if (existingBonus) {
          console.log(`  ⏭️  ${customer.name}: Already received birthday bonus today (skipping)`);
          results.push({
            customerId: customer.id,
            name: customer.name,
            tier: customer.loyaltyTier,
            bonus: 0,
            success: true,
            skipped: true,
            reason: "Already awarded today",
          });
          continue;
        }

        // Get tier-specific birthday bonus
        const tierConfig = LOYALTY_TIERS[customer.loyaltyTier] || LOYALTY_TIERS.BRONZE;
        const birthdayBonus = tierConfig.birthdayBonus;

        // Award points and create transaction in a single database transaction
        await prisma.$transaction(async (tx) => {
          // Add birthday points to customer balance
          await tx.customer.update({
            where: { id: customer.id },
            data: { loyaltyPoints: { increment: birthdayBonus } },
          });

          // Create transaction record for audit trail
          await tx.pointsTransaction.create({
            data: {
              customerId: customer.id,
              type: "BIRTHDAY_BONUS",
              points: birthdayBonus,
              description: `🎉 Happy Birthday ${customer.name}! ${customer.loyaltyTier} tier birthday bonus`,
            },
          });
        });

        console.log(`  🎁 ${customer.name} (${customer.loyaltyTier}): +${birthdayBonus} points`);

        results.push({
          customerId: customer.id,
          name: customer.name,
          tier: customer.loyaltyTier,
          bonus: birthdayBonus,
          success: true,
        });
      } catch (error) {
        console.error(`  ❌ Failed to award bonus to ${customer.name}:`, error.message);
        results.push({
          customerId: customer.id,
          name: customer.name,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`\n✅ Birthday rewards complete: ${successCount}/${customers.length} customers awarded`);

    return {
      success: true,
      count: successCount,
      customers: results,
    };
  } catch (error) {
    console.error("❌ Birthday rewards process failed:", error);
    return {
      success: false,
      error: error.message,
      count: 0,
      customers: [],
    };
  }
}

/**
 * Start the automated scheduler
 */
function startScheduler() {
  console.log("\n⏰ Birthday Rewards Scheduler Starting...");

  // Schedule: Run every day at 9:00 AM
  // Cron format: second minute hour day month dayOfWeek
  // '0 9 * * *' means: at 0 minutes, 9 hours, every day, every month, every day of week
  cron.schedule("0 9 * * *", async () => {
    console.log("\n📅 ==========================================");
    console.log("   Scheduled Birthday Rewards Check");
    console.log("   Time:", new Date().toLocaleString());
    console.log("==========================================");

    try {
      const result = await processBirthdayRewards();

      if (result.success && result.count > 0) {
        console.log(`\n🎊 Success! Awarded bonuses to ${result.count} customers`);
      }
    } catch (error) {
      console.error("Scheduled birthday rewards failed:", error);
    }
  });

  console.log("✅ Birthday rewards scheduler is running");
  console.log("📆 Schedule: Daily at 9:00 AM");
  console.log("🎂 Automatically checks for birthdays and awards bonuses");
  console.log("");

  // Optional: Run once immediately on startup (for testing)
  // Uncomment the next line to test immediately when server starts:
  // processBirthdayRewards();
}

/**
 * Stop the scheduler gracefully
 */
async function stopScheduler() {
  console.log("⏸️  Stopping birthday rewards scheduler...");
  await prisma.$disconnect();
  console.log("✅ Scheduler stopped");
}

// If running directly (for testing)
if (require.main === module) {
  console.log("🧪 Testing birthday rewards process...\n");
  processBirthdayRewards()
    .then((result) => {
      console.log("\n📊 Test Results:");
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error("Test failed:", error);
      process.exit(1);
    });
}

module.exports = {
  startScheduler,
  stopScheduler,
  processBirthdayRewards,
};
