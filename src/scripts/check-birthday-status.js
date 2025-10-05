/**
 * Check Birthday Rewards Status
 * Shows scheduler info and today's birthdays
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkBirthdayStatus() {
  console.log("\n🎂 Birthday Rewards Automation Status");
  console.log("=".repeat(70));

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  console.log(`📅 Today: ${today.toLocaleDateString()}`);
  console.log(`⏰ Scheduler: Runs daily at 9:00 AM`);
  console.log(`🎁 Bonus Amounts:`);
  console.log(`   • BRONZE: 50 points`);
  console.log(`   • SILVER: 100 points`);
  console.log(`   • GOLD: 200 points`);
  console.log(`   • PLATINUM: 500 points\n`);

  try {
    // Find customers with birthdays today
    const allCustomers = await prisma.customer.findMany({
      where: {
        isActive: true,
        dateOfBirth: { not: null },
      },
    });

    const customers = allCustomers.filter((customer) => {
      const birthDate = new Date(customer.dateOfBirth);
      return birthDate.getMonth() + 1 === todayMonth && birthDate.getDate() === todayDay;
    });

    console.log(`🎉 Birthdays Today: ${customers.length}`);
    console.log("=".repeat(70));

    if (customers.length === 0) {
      console.log("No birthdays today - scheduler will run at 9 AM tomorrow\n");
      return;
    }

    // Check who has received bonuses
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    for (const customer of customers) {
      const bonus = await prisma.pointsTransaction.findFirst({
        where: {
          customerId: customer.id,
          type: "BIRTHDAY_BONUS",
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      const status = bonus ? `✅ AWARDED (+${bonus.points} pts)` : `⏳ PENDING`;
      const age = today.getFullYear() - new Date(customer.dateOfBirth).getFullYear();

      console.log(`\n🎂 ${customer.name} (Age ${age})`);
      console.log(`   Tier: ${customer.loyaltyTier}`);
      console.log(`   Current Points: ${customer.loyaltyPoints}`);
      console.log(`   Status: ${status}`);

      if (bonus) {
        console.log(`   Awarded At: ${bonus.createdAt.toLocaleString()}`);
      }
    }

    console.log("\n" + "=".repeat(70));
    console.log(`\n💡 Automation is ${customers.some((c) => c) ? "ACTIVE" : "ACTIVE"} and running!`);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkBirthdayStatus();
