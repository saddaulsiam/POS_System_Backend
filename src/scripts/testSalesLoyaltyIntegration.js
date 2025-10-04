/**
 * Test Sales-Loyalty Integration
 * Verifies that tier multipliers are correctly applied during sales
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testSalesLoyaltyIntegration() {
  console.log("🧪 Testing Sales-Loyalty Integration...\n");

  try {
    // Get a customer to test with
    const customer = await prisma.customer.findFirst({
      where: { isActive: true },
      include: {
        pointsTransactions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    if (!customer) {
      console.log("❌ No customers found. Please create a customer first.");
      return;
    }

    console.log("📋 Test Customer:");
    console.log(`   Name: ${customer.name}`);
    console.log(`   Current Tier: ${customer.loyaltyTier}`);
    console.log(`   Current Points: ${customer.loyaltyPoints}`);

    // Get tier configuration
    const tierConfig = await prisma.loyaltyTierConfig.findUnique({
      where: { tier: customer.loyaltyTier },
    });

    const multiplier = tierConfig?.pointsMultiplier || 1.0;
    console.log(`   Tier Multiplier: ${multiplier}x`);

    // Calculate lifetime points
    const earnedPoints = await prisma.pointsTransaction.aggregate({
      where: {
        customerId: customer.id,
        points: { gt: 0 },
      },
      _sum: { points: true },
    });

    const lifetimePoints = earnedPoints._sum.points || 0;
    console.log(`   Lifetime Points: ${lifetimePoints}\n`);

    // Simulate a $100 purchase
    const purchaseAmount = 100;
    const basePoints = Math.floor(purchaseAmount / 10);
    const bonusPoints = Math.floor(basePoints * (multiplier - 1));
    const totalPoints = basePoints + bonusPoints;

    console.log("💰 Simulated $100 Purchase:");
    console.log(`   Base Points: ${basePoints} (1 point per $10)`);
    console.log(`   Bonus Points: ${bonusPoints} (${multiplier}x multiplier)`);
    console.log(`   Total Points to Award: ${totalPoints}\n`);

    // Check tier upgrade potential
    const newLifetimePoints = lifetimePoints + totalPoints;
    const calculateTier = (points) => {
      if (points >= 3000) return "PLATINUM";
      if (points >= 1500) return "GOLD";
      if (points >= 500) return "SILVER";
      return "BRONZE";
    };

    const qualifiedTier = calculateTier(newLifetimePoints);
    const tierOrder = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
    const currentIndex = tierOrder.indexOf(customer.loyaltyTier);
    const qualifiedIndex = tierOrder.indexOf(qualifiedTier);

    console.log("🎯 After Purchase:");
    console.log(`   New Current Points: ${customer.loyaltyPoints + totalPoints}`);
    console.log(`   New Lifetime Points: ${newLifetimePoints}`);
    console.log(`   Qualified Tier: ${qualifiedTier}`);

    if (qualifiedIndex > currentIndex) {
      console.log(`   ⬆️  TIER UPGRADE! ${customer.loyaltyTier} → ${qualifiedTier}`);
    } else if (qualifiedTier === customer.loyaltyTier) {
      console.log(`   ✅ Stays at ${customer.loyaltyTier} tier`);
    }

    console.log("\n📜 Recent Transactions:");
    customer.pointsTransactions.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.type}: ${t.points > 0 ? "+" : ""}${t.points} pts - ${t.description}`);
    });

    console.log("\n✅ Test complete!");
    console.log("\n💡 To test the actual sales endpoint:");
    console.log("   1. Make a sale through the POS system");
    console.log("   2. Check the customer's points history");
    console.log("   3. Verify tier multiplier was applied");
    console.log("   4. Check if tier upgraded (if threshold reached)");
  } catch (error) {
    console.error("❌ Test error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testSalesLoyaltyIntegration();
