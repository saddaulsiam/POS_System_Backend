/**
 * Test Birthday Rewards System
 *
 * This script will:
 * 1. Find some customers
 * 2. Set their birthdays to today (Oct 4)
 * 3. Show their current points
 * 4. Run the birthday rewards process
 * 5. Show their new points
 * 6. Display the transaction history
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Import the birthday rewards processor
const { processBirthdayRewards } = require("../scheduler");

async function testBirthdayRewards() {
  console.log("\n🧪 ==========================================");
  console.log("   BIRTHDAY REWARDS SYSTEM TEST");
  console.log("   Date: October 4, 2025");
  console.log("==========================================\n");

  try {
    // Step 1: Get some active customers
    console.log("📋 Step 1: Finding test customers...\n");

    const customers = await prisma.customer.findMany({
      where: { isActive: true },
      take: 3,
      orderBy: { id: "asc" },
    });

    if (customers.length === 0) {
      console.log("❌ No customers found! Please create some customers first.\n");
      return;
    }

    console.log(`✅ Found ${customers.length} customers to test:\n`);

    // Show customers before update
    for (const customer of customers) {
      console.log(`   👤 ${customer.name}`);
      console.log(`      ID: ${customer.id}`);
      console.log(`      Current Points: ${customer.loyaltyPoints}`);
      console.log(`      Current Birthday: ${customer.dateOfBirth || "Not set"}`);
      console.log();
    }

    // Step 2: Set their birthdays to today (any year)
    console.log("🎂 Step 2: Setting birthdays to today (October 4)...\n");

    const today = new Date();
    const testBirthdays = [
      new Date(1990, 9, 4), // Oct 4, 1990 (BRONZE tier)
      new Date(1985, 9, 4), // Oct 4, 1985 (SILVER tier)
      new Date(1995, 9, 4), // Oct 4, 1995 (GOLD tier)
    ];

    const updatedCustomers = [];
    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      const birthday = testBirthdays[i] || testBirthdays[0];

      const updated = await prisma.customer.update({
        where: { id: customer.id },
        data: { dateOfBirth: birthday },
      });

      updatedCustomers.push(updated);
      console.log(`   ✅ ${customer.name} → Birthday set to ${birthday.toLocaleDateString()}`);
    }

    console.log("\n✅ Birthdays updated successfully!\n");

    // Step 3: Show current state
    console.log("📊 Step 3: Current state BEFORE birthday rewards:\n");

    // Get tier configurations
    const tierConfigs = await prisma.loyaltyTierConfig.findMany({
      orderBy: { minimumPoints: "asc" },
    });

    for (const customer of updatedCustomers) {
      // Calculate tier based on lifetime points
      const lifetimePoints = customer.lifetimePoints || 0;
      let currentTier = tierConfigs[0]; // Default to BRONZE

      for (const tier of tierConfigs) {
        if (lifetimePoints >= tier.minimumPoints) {
          currentTier = tier;
        }
      }

      console.log(`   👤 ${customer.name}`);
      console.log(`      Points: ${customer.loyaltyPoints}`);
      console.log(`      Lifetime Points: ${lifetimePoints}`);
      console.log(`      Tier: ${currentTier.tier}`);
      console.log(`      Expected Bonus: ${currentTier.birthdayBonus} points`);
      console.log();
    }

    // Step 4: Run the birthday rewards process
    console.log("🎁 Step 4: Running birthday rewards process...\n");
    console.log("=".repeat(50));

    const result = await processBirthdayRewards();

    console.log("=".repeat(50));
    console.log();

    // Step 5: Check the results
    console.log("📊 Step 5: Results AFTER birthday rewards:\n");

    for (const customer of updatedCustomers) {
      const refreshed = await prisma.customer.findUnique({
        where: { id: customer.id },
      });

      // Calculate tier
      const lifetimePoints = refreshed.lifetimePoints || 0;
      let currentTier = tierConfigs[0];

      for (const tier of tierConfigs) {
        if (lifetimePoints >= tier.minimumPoints) {
          currentTier = tier;
        }
      }

      const pointsAwarded = refreshed.loyaltyPoints - customer.loyaltyPoints;

      console.log(`   👤 ${refreshed.name}`);
      console.log(`      Points Before: ${customer.loyaltyPoints}`);
      console.log(`      Points After: ${refreshed.loyaltyPoints}`);
      console.log(`      Points Awarded: +${pointsAwarded} 🎉`);
      console.log(`      Tier: ${currentTier.tier}`);
      console.log();
    }

    // Step 6: Show transaction history
    console.log("📜 Step 6: Birthday Transaction History:\n");

    for (const customer of updatedCustomers) {
      const transactions = await prisma.pointsTransaction.findMany({
        where: {
          customerId: customer.id,
          type: "BIRTHDAY_BONUS",
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      });

      if (transactions.length > 0) {
        const tx = transactions[0];
        console.log(`   🎂 ${customer.name}:`);
        console.log(`      ${tx.description}`);
        console.log(`      Points: +${tx.points}`);
        console.log(`      Time: ${tx.createdAt.toLocaleString()}`);
        console.log();
      }
    }

    // Summary
    console.log("=".repeat(50));
    console.log("\n✅ TEST COMPLETE!\n");
    console.log("Summary:");
    console.log(`   Customers tested: ${updatedCustomers.length}`);
    console.log(`   Birthdays awarded: ${result.count}`);
    console.log(`   Status: ${result.success ? "✅ SUCCESS" : "❌ FAILED"}`);
    console.log("\n" + "=".repeat(50) + "\n");

    // Verification checklist
    console.log("🔍 Verification Checklist:\n");
    console.log("   [ ] Did all customers receive points?");
    console.log("   [ ] Were the correct tier bonuses awarded?");
    console.log("   [ ] Do transaction records exist?");
    console.log("   [ ] Are the descriptions correct?");
    console.log("   [ ] Check customer dashboard for birthday message\n");
  } catch (error) {
    console.error("\n❌ ERROR during test:", error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testBirthdayRewards();
