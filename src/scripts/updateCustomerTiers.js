const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function updateCustomerTiers() {
  try {
    console.log("🔄 Updating customer tiers based on lifetime points...\n");

    const tierMinimums = {
      BRONZE: 0,
      SILVER: 500,
      GOLD: 1500,
      PLATINUM: 3000,
    };

    // Get all customers
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        loyaltyTier: true,
      },
    });

    console.log(`Found ${customers.length} customers to check\n`);
    console.log("=".repeat(80));

    for (const customer of customers) {
      // Calculate lifetime points (sum of all positive transactions)
      const earnedPoints = await prisma.pointsTransaction.aggregate({
        where: {
          customerId: customer.id,
          points: { gt: 0 },
        },
        _sum: { points: true },
      });

      const lifetimePoints = earnedPoints._sum.points || 0;

      // Determine correct tier based on lifetime points
      let qualifiedTier = "BRONZE";
      if (lifetimePoints >= tierMinimums.PLATINUM) {
        qualifiedTier = "PLATINUM";
      } else if (lifetimePoints >= tierMinimums.GOLD) {
        qualifiedTier = "GOLD";
      } else if (lifetimePoints >= tierMinimums.SILVER) {
        qualifiedTier = "SILVER";
      }

      const currentTier = customer.loyaltyTier;

      // Tier order for comparison (NEVER downgrade!)
      const tierOrder = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
      const currentTierIndex = tierOrder.indexOf(currentTier);
      const qualifiedTierIndex = tierOrder.indexOf(qualifiedTier);

      // Only upgrade if qualified tier is HIGHER than current tier
      const shouldUpgrade = qualifiedTierIndex > currentTierIndex;
      const correctTier = shouldUpgrade ? qualifiedTier : currentTier;

      console.log(`\nCustomer: ${customer.name} (ID: ${customer.id})`);
      console.log(`  Current Points: ${customer.loyaltyPoints}`);
      console.log(`  Lifetime Points: ${lifetimePoints}`);
      console.log(`  Current Tier: ${currentTier}`);
      console.log(`  Qualified Tier: ${qualifiedTier}`);

      if (shouldUpgrade) {
        console.log(`  ⬆️  UPGRADE! ${currentTier} → ${qualifiedTier}...`);

        await prisma.customer.update({
          where: { id: customer.id },
          data: { loyaltyTier: qualifiedTier },
        });

        // Create a transaction record for the tier change
        await prisma.pointsTransaction.create({
          data: {
            customerId: customer.id,
            type: "ADJUSTED",
            points: 0, // No points change, just tier upgrade
            description: `Tier upgraded from ${currentTier} to ${qualifiedTier} based on ${lifetimePoints} lifetime points`,
          },
        });

        console.log(`  ✅ Upgraded to ${qualifiedTier}!`);
      } else if (qualifiedTierIndex < currentTierIndex) {
        console.log(`  🔒 Would downgrade to ${qualifiedTier}, but KEEPING ${currentTier} (tiers never go down!)`);
      } else {
        console.log(`  ✅ Tier is correct`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n🎉 Tier update complete!\n");

    // Show summary
    console.log("Final Tier Distribution:");
    const tierCounts = await prisma.customer.groupBy({
      by: ["loyaltyTier"],
      _count: true,
    });

    tierCounts.forEach((tier) => {
      const emoji = {
        BRONZE: "🥉",
        SILVER: "🥈",
        GOLD: "🥇",
        PLATINUM: "💎",
      };
      console.log(`  ${emoji[tier.loyaltyTier]} ${tier.loyaltyTier}: ${tier._count} customers`);
    });

    console.log("\n✅ All done!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCustomerTiers();
