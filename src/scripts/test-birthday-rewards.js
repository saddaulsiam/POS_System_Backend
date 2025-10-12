/**
 * Test Birthday Rewards System
 *
 * This script will:
 * 1. Find or create a test customer with today's birthday
 * 2. Run the birthday rewards check
 * 3. Verify points were awarded
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testBirthdayRewards() {
  console.log("🧪 Starting Birthday Rewards Test\n");
  console.log("=".repeat(60));

  try {
    const today = new Date();
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();

    console.log(`📅 Today's Date: ${todayMonth}/${todayDay}/${today.getFullYear()}\n`);

    // Step 1: Find or create a test customer with today's birthday
    console.log("Step 1: Finding/creating test customer with today's birthday...");

    let testCustomer = await prisma.customer.findFirst({
      where: {
        name: { contains: "Birthday Test" },
        isActive: true,
      },
    });

    if (!testCustomer) {
      // Create a new test customer with birthday today
      const birthYear = 1990;
      const birthDate = new Date(birthYear, todayMonth - 1, todayDay);

      testCustomer = await prisma.customer.create({
        data: {
          name: "Birthday Test Customer",
          phoneNumber: "1234567890",
          email: "birthday.test@example.com",
          dateOfBirth: birthDate,
          loyaltyPoints: 100,
          loyaltyTier: "BRONZE",
          isActive: true,
        },
      });
      console.log(`✅ Created test customer: ${testCustomer.name}`);
    } else {
      // Update existing test customer's birthday to today
      const birthYear = 1990;
      const birthDate = new Date(birthYear, todayMonth - 1, todayDay);

      testCustomer = await prisma.customer.update({
        where: { id: testCustomer.id },
        data: {
          dateOfBirth: birthDate,
          isActive: true,
        },
      });
      console.log(`✅ Updated test customer: ${testCustomer.name}`);
    }

    console.log(`   ID: ${testCustomer.id}`);
    console.log(`   Birthday: ${testCustomer.dateOfBirth.toLocaleDateString()}`);
    console.log(`   Tier: ${testCustomer.loyaltyTier}`);
    console.log(`   Current Points: ${testCustomer.loyaltyPoints}`);
    console.log("");

    // Step 2: Check for existing birthday bonus today
    console.log("Step 2: Checking for existing birthday bonus...");
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const existingBonus = await prisma.pointsTransaction.findFirst({
      where: {
        customerId: testCustomer.id,
        type: "BIRTHDAY_BONUS",
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    if (existingBonus) {
      console.log(`⚠️  Birthday bonus already awarded today!`);
      console.log(`   Transaction ID: ${existingBonus.id}`);
      console.log(`   Points Awarded: ${existingBonus.points}`);
      console.log(`   Time: ${existingBonus.createdAt.toLocaleString()}`);
      console.log(`\n💡 To test again, delete the transaction or wait until tomorrow.`);
      console.log(`   Run: DELETE FROM PointsTransaction WHERE id = ${existingBonus.id};`);
    } else {
      console.log(`✅ No birthday bonus awarded yet - ready to test!\n`);

      // Step 3: Run the birthday rewards process
      console.log("Step 3: Running birthday rewards check...");
      console.log("=".repeat(60));

      const { processBirthdayRewards } = require("./scheduler");
      const result = await processBirthdayRewards();

      console.log("=".repeat(60));
      console.log("\n📊 Results:");
      console.log(JSON.stringify(result, null, 2));

      // Step 4: Verify the results
      console.log("\nStep 4: Verifying points were awarded...");

      const updatedCustomer = await prisma.customer.findUnique({
        where: { id: testCustomer.id },
      });

      const newTransaction = await prisma.pointsTransaction.findFirst({
        where: {
          customerId: testCustomer.id,
          type: "BIRTHDAY_BONUS",
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      console.log("\n✅ Verification Complete:");
      console.log(`   Previous Points: ${testCustomer.loyaltyPoints}`);
      console.log(`   Current Points: ${updatedCustomer.loyaltyPoints}`);
      console.log(`   Points Added: ${updatedCustomer.loyaltyPoints - testCustomer.loyaltyPoints}`);

      if (newTransaction) {
        console.log(`   Transaction ID: ${newTransaction.id}`);
        console.log(`   Description: ${newTransaction.description}`);
        console.log(`   Created: ${newTransaction.createdAt.toLocaleString()}`);
      }

      if (updatedCustomer.loyaltyPoints > testCustomer.loyaltyPoints) {
        console.log("\n🎉 SUCCESS! Birthday rewards are working correctly!");
      } else {
        console.log("\n❌ FAILED! Points were not awarded.");
      }
    }
  } catch (error) {
    console.error("\n❌ Test Failed:", error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
    console.log("\n" + "=".repeat(60));
    console.log("Test Complete");
  }
}

// Run the test
testBirthdayRewards();
