import cron from "node-cron";
import { fileURLToPath } from "url";
import prisma from "../prisma.js";

const __filename = fileURLToPath(import.meta.url);

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
        const customerStores = await prisma.customerStore.findMany({
          where: { customerId: customer.id },
        });

        for (const customerStore of customerStores) {
          // Check if birthday bonus already awarded today for this store
          const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
          const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

          const existingBonus = await prisma.pointsTransaction.findFirst({
            where: {
              customerStoreId: customerStore.id,
              type: "BIRTHDAY_BONUS",
              createdAt: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          });

          if (existingBonus) {
            console.log(
              `  ⏭️  ${customer.name} (Store ${customerStore.storeId}): Already received birthday bonus today (skipping)`,
            );
            results.push({
              customerId: customer.id,
              storeId: customerStore.storeId,
              name: customer.name,
              tier: customerStore.loyaltyTier,
              bonus: 0,
              success: true,
              skipped: true,
              reason: "Already awarded today",
            });
            continue;
          }

          // Get tier-specific birthday bonus
          const tierConfig = LOYALTY_TIERS[customerStore.loyaltyTier] || LOYALTY_TIERS.BRONZE;
          const birthdayBonus = tierConfig.birthdayBonus;

          // Award points and create transaction in a single database transaction
          await prisma.$transaction(async (tx) => {
            // Add birthday points to customer balance in this store
            await tx.customerStore.update({
              where: { id: customerStore.id },
              data: { loyaltyPoints: { increment: birthdayBonus } },
            });

            // Create transaction record for audit trail
            await tx.pointsTransaction.create({
              data: {
                customerStoreId: customerStore.id,
                customerId: customer.id,
                type: "BIRTHDAY_BONUS",
                points: birthdayBonus,
                description: `🎉 Happy Birthday ${customer.name}! ${customerStore.loyaltyTier} tier birthday bonus`,
              },
            });
          });

          console.log(
            `  🎁 ${customer.name} (Store ${customerStore.storeId}): +${birthdayBonus} points (${customerStore.loyaltyTier})`,
          );

          results.push({
            customerId: customer.id,
            storeId: customerStore.storeId,
            name: customer.name,
            tier: customerStore.loyaltyTier,
            bonus: birthdayBonus,
            success: true,
          });
        }
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
  console.log("\n⏰ Automated Scheduler Starting...");

  // Schedule 1: Birthday Rewards - Run every day at 9:00 AM
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

  // Schedule 2: Subscription Expiration Check - Run every day at midnight
  cron.schedule("0 0 * * *", async () => {
    console.log("\n📅 ==========================================");
    console.log("   Scheduled Subscription Expiration Check");
    console.log("   Time:", new Date().toLocaleString());
    console.log("==========================================");

    try {
      const result = await checkExpiredSubscriptions();

      if (result.success && result.totalExpired > 0) {
        console.log(`\n⚠️  Marked ${result.totalExpired} subscription(s) as expired`);
      }
    } catch (error) {
      console.error("Scheduled subscription check failed:", error);
    }
  });

  // Schedule 3: Subscription Renewal Warnings Check - Run every day at 10:00 AM
  cron.schedule("0 10 * * *", async () => {
    console.log("\n📅 ==========================================");
    console.log("   Scheduled Subscription Renewal Reminders Check");
    console.log("   Time:", new Date().toLocaleString());
    console.log("==========================================");

    try {
      await autoSendExpiringReminders();
    } catch (error) {
      console.error("Scheduled renewal warnings check failed:", error);
    }
  });

  console.log("✅ Automated scheduler is running");
  console.log("📆 Schedule 1: Birthday rewards - Daily at 9:00 AM");
  console.log("📆 Schedule 2: Subscription expiration - Daily at midnight");
  console.log("📆 Schedule 3: Renewal warning reminders - Daily at 10:00 AM");
  console.log("🎂 Automatically checks for birthdays and awards bonuses");
  console.log("💳 Automatically marks expired subscriptions");
  console.log("✉️  Automatically sends renewal reminders 3 days before expiry");

  // Optional: Run once immediately on startup (for testing)
  // Uncomment the next lines to test immediately when server starts:
  // processBirthdayRewards();
  // checkExpiredSubscriptions();
}

/**
 * Check and update expired subscriptions
 */
async function checkExpiredSubscriptions() {
  try {
    const now = new Date();
    console.log(`\n🔍 Checking for expired subscriptions at ${now.toISOString()}...`);

    // Find all TRIAL subscriptions where trial has expired
    const expiredTrials = await prisma.subscription.updateMany({
      where: {
        status: "TRIAL",
        trialEndDate: {
          lt: now,
        },
      },
      data: {
        status: "EXPIRED",
      },
    });

    // Find all ACTIVE subscriptions where subscription has expired
    const expiredSubscriptions = await prisma.subscription.updateMany({
      where: {
        status: "ACTIVE",
        subscriptionEndDate: {
          not: null,
          lt: now,
        },
      },
      data: {
        status: "EXPIRED",
      },
    });

    const totalExpired = expiredTrials.count + expiredSubscriptions.count;

    if (totalExpired > 0) {
      console.log(`⚠️  Marked ${totalExpired} subscription(s) as expired:`);
      console.log(`   - Trials: ${expiredTrials.count}`);
      console.log(`   - Active subscriptions: ${expiredSubscriptions.count}`);
    } else {
      console.log("✅ No expired subscriptions found - all clear!");
    }

    return {
      success: true,
      expiredTrials: expiredTrials.count,
      expiredSubscriptions: expiredSubscriptions.count,
      totalExpired,
    };
  } catch (error) {
    console.error("❌ Error checking expired subscriptions:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Automatically send renewal reminder emails to owners whose subscriptions expire in exactly 3 days.
 */
async function autoSendExpiringReminders() {
  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);

    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    console.log(
      `\n🔍 Checking for subscriptions expiring between ${startOfDay.toISOString()} and ${endOfDay.toISOString()}...`,
    );

    const subscriptions = await prisma.subscription.findMany({
      where: {
        OR: [
          {
            status: "ACTIVE",
            subscriptionEndDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
          {
            status: "TRIAL",
            trialEndDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        ],
      },
      include: {
        store: {
          include: {
            owner: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (subscriptions.length === 0) {
      console.log("✅ No subscriptions expiring in 3 days - all clear!");
      return { success: true, count: 0 };
    }

    console.log(`✉️ Sending renewal reminders to ${subscriptions.length} expiring store(s)...`);

    const { sendRenewalReminderService } = await import("../modules/admin/adminService.js");
    let sentCount = 0;

    for (const sub of subscriptions) {
      try {
        await sendRenewalReminderService(sub.id);
        sentCount++;
      } catch (err) {
        console.error(`Failed to send auto reminder for subscription ID ${sub.id}:`, err.message);
      }
    }

    console.log(`✅ Completed: Sent ${sentCount}/${subscriptions.length} reminders successfully.`);
    return { success: true, count: sentCount };
  } catch (error) {
    console.error("❌ Auto renewal reminder dispatch failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Stop the scheduler gracefully
 */
async function stopScheduler() {
  console.log("⏸️  Stopping scheduler...");
  await prisma.$disconnect();
  console.log("✅ Scheduler stopped");
}

// If running directly (for testing)
if (process.argv[1] === __filename) {
  const testType = process.argv[2] || "birthday";

  if (testType === "subscription") {
    console.log("🧪 Testing subscription expiration check...\n");
    checkExpiredSubscriptions()
      .then((result) => {
        console.log("\n📊 Test Results:");
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      })
      .catch((error) => {
        console.error("Test failed:", error);
        process.exit(1);
      });
  } else if (testType === "reminder") {
    console.log("🧪 Testing subscription renewal reminders check...\n");
    autoSendExpiringReminders()
      .then((result) => {
        console.log("\n📊 Test Results:");
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      })
      .catch((error) => {
        console.error("Test failed:", error);
        process.exit(1);
      });
  } else {
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
}

export { processBirthdayRewards, checkExpiredSubscriptions, autoSendExpiringReminders, startScheduler, stopScheduler };
