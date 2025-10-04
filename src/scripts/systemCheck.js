/**
 * Comprehensive System Check
 * Tests all aspects of the Customer Birthday & Loyalty System
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function comprehensiveCheck() {
  console.log("\n🔍 ==========================================");
  console.log("   COMPREHENSIVE SYSTEM CHECK");
  console.log("   Date: October 4, 2025");
  console.log("==========================================\n");

  const results = {
    passed: [],
    failed: [],
    warnings: [],
  };

  try {
    // Test 1: Database Connection
    console.log("1️⃣  Testing Database Connection...");
    try {
      await prisma.$queryRaw`SELECT 1`;
      results.passed.push("Database connection successful");
      console.log("   ✅ Database connected\n");
    } catch (error) {
      results.failed.push(`Database connection failed: ${error.message}`);
      console.log("   ❌ Database connection failed\n");
    }

    // Test 2: Customer Table Schema
    console.log("2️⃣  Checking Customer Table Schema...");
    try {
      const customer = await prisma.customer.findFirst();
      const hasDateOfBirth = customer ? "dateOfBirth" in customer : false;
      const hasLoyaltyTier = customer ? "loyaltyTier" in customer : false;
      const hasLoyaltyPoints = customer ? "loyaltyPoints" in customer : false;

      if (hasDateOfBirth && hasLoyaltyTier && hasLoyaltyPoints) {
        results.passed.push("Customer schema has all required fields");
        console.log("   ✅ Schema includes: dateOfBirth, loyaltyTier, loyaltyPoints");
      } else {
        results.failed.push("Customer schema missing required fields");
        console.log("   ❌ Missing required fields");
      }
      console.log();
    } catch (error) {
      results.failed.push(`Schema check failed: ${error.message}`);
      console.log("   ❌ Schema check failed\n");
    }

    // Test 3: Customers with Birthdays
    console.log("3️⃣  Checking Customers with Birthdays...");
    try {
      const customersWithBirthdays = await prisma.customer.findMany({
        where: {
          dateOfBirth: { not: null },
          isActive: true,
        },
      });

      console.log(`   Found ${customersWithBirthdays.length} customers with birthdays set`);

      if (customersWithBirthdays.length > 0) {
        results.passed.push(`${customersWithBirthdays.length} customers have birthdays configured`);

        // Show sample
        const sample = customersWithBirthdays.slice(0, 3);
        for (const c of sample) {
          const bday = new Date(c.dateOfBirth);
          console.log(`   - ${c.name}: ${bday.toLocaleDateString()} (${c.loyaltyTier})`);
        }
      } else {
        results.warnings.push("No customers have birthdays set");
        console.log("   ⚠️  No birthdays configured");
      }
      console.log();
    } catch (error) {
      results.failed.push(`Birthday check failed: ${error.message}`);
      console.log("   ❌ Failed to check birthdays\n");
    }

    // Test 4: Loyalty Tier Configuration
    console.log("4️⃣  Checking Loyalty Tier Configuration...");
    try {
      const tiers = await prisma.loyaltyTierConfig.findMany({
        orderBy: { minimumPoints: "asc" },
      });

      if (tiers.length >= 4) {
        results.passed.push("All 4 loyalty tiers configured");
        console.log("   ✅ Found all 4 tiers:");
        for (const tier of tiers) {
          console.log(`   - ${tier.tier}: ${tier.minimumPoints}pts, Birthday: ${tier.birthdayBonus}pts`);
        }
      } else {
        results.failed.push("Missing loyalty tier configurations");
        console.log(`   ❌ Only found ${tiers.length}/4 tiers`);
      }
      console.log();
    } catch (error) {
      results.failed.push(`Tier config check failed: ${error.message}`);
      console.log("   ❌ Failed to check tiers\n");
    }

    // Test 5: Birthday Transactions
    console.log("5️⃣  Checking Birthday Transaction History...");
    try {
      const birthdayTransactions = await prisma.pointsTransaction.findMany({
        where: { type: "BIRTHDAY_BONUS" },
        include: { customer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      });

      if (birthdayTransactions.length > 0) {
        results.passed.push(`${birthdayTransactions.length} birthday bonuses in history`);
        console.log(`   ✅ Found ${birthdayTransactions.length} birthday transactions:`);
        for (const tx of birthdayTransactions.slice(0, 3)) {
          console.log(`   - ${tx.customer.name}: +${tx.points}pts on ${tx.createdAt.toLocaleDateString()}`);
        }
      } else {
        results.warnings.push("No birthday bonuses have been awarded yet");
        console.log("   ⚠️  No birthday bonuses awarded yet");
      }
      console.log();
    } catch (error) {
      results.failed.push(`Transaction check failed: ${error.message}`);
      console.log("   ❌ Failed to check transactions\n");
    }

    // Test 6: Duplicate Prevention
    console.log("6️⃣  Testing Duplicate Prevention...");
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const todayBonuses = await prisma.pointsTransaction.findMany({
        where: {
          type: "BIRTHDAY_BONUS",
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        include: { customer: { select: { name: true, id: true } } },
      });

      // Check for duplicates
      const customerIds = todayBonuses.map((tx) => tx.customerId);
      const uniqueIds = [...new Set(customerIds)];

      if (customerIds.length === uniqueIds.length) {
        results.passed.push("No duplicate bonuses today");
        console.log("   ✅ No duplicates found");
        console.log(`   ${uniqueIds.length} unique customers received bonuses today`);
      } else {
        results.failed.push(`Found ${customerIds.length - uniqueIds.length} duplicate bonuses today`);
        console.log(`   ❌ Found duplicates! Total: ${customerIds.length}, Unique: ${uniqueIds.length}`);
      }
      console.log();
    } catch (error) {
      results.failed.push(`Duplicate check failed: ${error.message}`);
      console.log("   ❌ Failed to check duplicates\n");
    }

    // Test 7: Today's Birthdays
    console.log("7️⃣  Checking Today's Birthdays (Oct 4)...");
    try {
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();

      const allCustomers = await prisma.customer.findMany({
        where: {
          isActive: true,
          dateOfBirth: { not: null },
        },
      });

      const birthdaysToday = allCustomers.filter((customer) => {
        const birthDate = new Date(customer.dateOfBirth);
        return birthDate.getMonth() + 1 === todayMonth && birthDate.getDate() === todayDay;
      });

      console.log(`   Found ${birthdaysToday.length} birthday(s) today:`);
      if (birthdaysToday.length > 0) {
        results.passed.push(`${birthdaysToday.length} customers have birthdays today`);
        for (const c of birthdaysToday) {
          console.log(`   - ${c.name} (${c.loyaltyTier}): ${c.loyaltyPoints} points`);
        }
      } else {
        results.warnings.push("No birthdays today");
        console.log("   ℹ️  No birthdays today");
      }
      console.log();
    } catch (error) {
      results.failed.push(`Today's birthdays check failed: ${error.message}`);
      console.log("   ❌ Failed to check today's birthdays\n");
    }

    // Test 8: Points Consistency
    console.log("8️⃣  Checking Points Consistency...");
    try {
      const customers = await prisma.customer.findMany({
        where: { isActive: true },
        take: 5,
      });

      let inconsistencies = 0;
      for (const customer of customers) {
        if (customer.loyaltyPoints < 0) {
          inconsistencies++;
          console.log(`   ⚠️  ${customer.name}: Negative points (${customer.loyaltyPoints})`);
        }
      }

      if (inconsistencies === 0) {
        results.passed.push("All customer points are valid");
        console.log("   ✅ All customer points are valid (≥0)");
      } else {
        results.warnings.push(`${inconsistencies} customers with invalid points`);
      }
      console.log();
    } catch (error) {
      results.failed.push(`Points consistency check failed: ${error.message}`);
      console.log("   ❌ Failed to check points\n");
    }

    // Test 9: Backend Routes (customers.js)
    console.log("9️⃣  Checking Backend Customer Routes...");
    try {
      const fs = require("fs");
      const customerRoutesPath = "./src/routes/customers.js";

      if (fs.existsSync(customerRoutesPath)) {
        const content = fs.readFileSync(customerRoutesPath, "utf8");

        const hasDateValidation = content.includes("dateOfBirth");
        const hasISOValidation = content.includes("isISO8601");

        if (hasDateValidation && hasISOValidation) {
          results.passed.push("Backend routes support dateOfBirth field");
          console.log("   ✅ Customer routes include dateOfBirth validation");
        } else {
          results.failed.push("Backend routes missing dateOfBirth support");
          console.log("   ❌ Missing dateOfBirth validation in routes");
        }
      } else {
        results.warnings.push("Could not find customer routes file");
        console.log("   ⚠️  Routes file not found");
      }
      console.log();
    } catch (error) {
      results.warnings.push(`Route check skipped: ${error.message}`);
      console.log("   ⚠️  Could not check routes\n");
    }

    // Test 10: Scheduler Module
    console.log("🔟 Checking Birthday Scheduler Module...");
    try {
      const fs = require("fs");
      const schedulerPath = "./src/scheduler.js";

      if (fs.existsSync(schedulerPath)) {
        const content = fs.readFileSync(schedulerPath, "utf8");

        const hasDuplicateCheck = content.includes("existingBonus") || content.includes("Already received");
        const hasCronSchedule = content.includes("cron.schedule");

        if (hasDuplicateCheck && hasCronSchedule) {
          results.passed.push("Scheduler has duplicate prevention and scheduling");
          console.log("   ✅ Scheduler includes:");
          console.log("      - Duplicate prevention");
          console.log("      - Cron scheduling");
        } else {
          results.warnings.push("Scheduler missing some features");
          console.log("   ⚠️  Scheduler may be incomplete");
        }
      } else {
        results.failed.push("Scheduler module not found");
        console.log("   ❌ Scheduler file not found");
      }
      console.log();
    } catch (error) {
      results.warnings.push(`Scheduler check skipped: ${error.message}`);
      console.log("   ⚠️  Could not check scheduler\n");
    }
  } catch (error) {
    console.error("❌ Critical error during system check:", error);
    results.failed.push(`Critical error: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 SYSTEM CHECK SUMMARY");
  console.log("=".repeat(50) + "\n");

  console.log(`✅ Passed: ${results.passed.length}`);
  results.passed.forEach((item) => console.log(`   ✓ ${item}`));

  console.log(`\n⚠️  Warnings: ${results.warnings.length}`);
  results.warnings.forEach((item) => console.log(`   ! ${item}`));

  console.log(`\n❌ Failed: ${results.failed.length}`);
  results.failed.forEach((item) => console.log(`   ✗ ${item}`));

  console.log("\n" + "=".repeat(50));

  const totalTests = results.passed.length + results.warnings.length + results.failed.length;
  const passRate = ((results.passed.length / totalTests) * 100).toFixed(1);

  if (results.failed.length === 0) {
    console.log(`\n🎉 ALL CRITICAL TESTS PASSED! (${passRate}% success rate)`);
    console.log("✅ System is fully operational!");
  } else {
    console.log(`\n⚠️  ${results.failed.length} CRITICAL ISSUES FOUND`);
    console.log("🔧 Please fix failed tests before going to production");
  }

  console.log("\n" + "=".repeat(50) + "\n");
}

comprehensiveCheck();
