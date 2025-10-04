const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkProgressCalculation() {
  try {
    console.log("🔍 Checking Progress to Next Tier Calculation...\n");

    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        loyaltyTier: true,
      },
    });

    const tierMinimums = {
      BRONZE: 0,
      SILVER: 500,
      GOLD: 1500,
      PLATINUM: 3000,
    };

    const tierOrder = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];

    for (const customer of customers) {
      console.log("=".repeat(80));
      console.log(`\nCustomer: ${customer.name} (ID: ${customer.id})`);
      console.log(`Current Tier: ${customer.loyaltyTier}`);
      console.log(`Current Points (Available): ${customer.loyaltyPoints}`);

      // Calculate lifetime points (same as backend)
      const earnedPoints = await prisma.pointsTransaction.aggregate({
        where: {
          customerId: customer.id,
          points: { gt: 0 },
        },
        _sum: { points: true },
      });

      const lifetimePoints = earnedPoints._sum.points || 0;
      console.log(`Lifetime Points (Earned): ${lifetimePoints}`);

      // Get next tier
      const currentIndex = tierOrder.indexOf(customer.loyaltyTier);
      const nextTier = currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;

      if (nextTier) {
        const currentTierMin = tierMinimums[customer.loyaltyTier];
        const nextTierMin = tierMinimums[nextTier];

        console.log(`\nNext Tier: ${nextTier}`);
        console.log(`Current Tier Minimum: ${currentTierMin}`);
        console.log(`Next Tier Minimum: ${nextTierMin}`);

        // Backend calculation
        const pointsNeeded = nextTierMin - lifetimePoints;
        console.log(`\nBackend Calculation:`);
        console.log(`  Points Needed = ${nextTierMin} - ${lifetimePoints} = ${pointsNeeded}`);

        // Frontend calculation
        const pointsInCurrentTier = lifetimePoints - currentTierMin;
        const pointsNeededForNextTier = nextTierMin - currentTierMin;
        const progressPercentage = (pointsInCurrentTier / pointsNeededForNextTier) * 100;

        console.log(`\nFrontend Calculation:`);
        console.log(`  Points in Current Tier = ${lifetimePoints} - ${currentTierMin} = ${pointsInCurrentTier}`);
        console.log(`  Points Needed for Next Tier = ${nextTierMin} - ${currentTierMin} = ${pointsNeededForNextTier}`);
        console.log(
          `  Progress = (${pointsInCurrentTier} / ${pointsNeededForNextTier}) × 100 = ${progressPercentage.toFixed(2)}%`
        );

        console.log(`\nExpected UI Display:`);
        console.log(`  "Progress to ${nextTier}"`);
        console.log(`  Progress Bar: ${progressPercentage.toFixed(0)}%`);
        console.log(`  "${pointsNeeded} points to go"`);

        // Validation
        if (pointsNeeded < 0) {
          console.log(`\n  ⚠️  WARNING: Points needed is negative! Customer should be upgraded to ${nextTier}!`);
        } else if (progressPercentage > 100) {
          console.log(`\n  ⚠️  WARNING: Progress > 100%! Customer should be upgraded!`);
        } else if (progressPercentage < 0) {
          console.log(`\n  ❌  ERROR: Progress is negative! Something is wrong!`);
        } else {
          console.log(`\n  ✅  Calculations look correct!`);
        }
      } else {
        console.log(`\n✨ Maximum tier reached (PLATINUM)!`);
      }

      console.log();
    }

    console.log("=".repeat(80));
    console.log("\n✅ Check complete!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProgressCalculation();
