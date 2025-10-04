const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testStatisticsEndpoint() {
  try {
    console.log("🧪 Testing Statistics Calculation...\n");

    // Simulate the exact logic from the endpoint
    const customersByTier = await prisma.customer.groupBy({
      by: ["loyaltyTier"],
      where: { isActive: true },
      _count: true,
    });

    console.log("Raw customersByTier:", JSON.stringify(customersByTier, null, 2));

    // Total points issued
    const totalPointsIssued = await prisma.pointsTransaction.aggregate({
      where: { points: { gt: 0 } },
      _sum: { points: true },
    });

    // Total points redeemed
    const totalPointsRedeemed = await prisma.pointsTransaction.aggregate({
      where: { type: "REDEEMED" },
      _sum: { points: true },
    });

    // Active offers
    const now = new Date();
    const activeOffersCount = await prisma.loyaltyOffer.count({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    // Top customers
    const topCustomers = await prisma.customer.findMany({
      where: { isActive: true },
      orderBy: { loyaltyPoints: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        loyaltyTier: true,
      },
    });

    // Format customers by tier
    const tierDistribution = {};
    const allTiers = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];

    // Initialize all tiers with 0
    allTiers.forEach((tier) => {
      tierDistribution[tier] = 0;
    });

    // Fill in actual counts (FIXED)
    customersByTier.forEach((item) => {
      console.log(`Processing tier ${item.loyaltyTier}:`, item);
      tierDistribution[item.loyaltyTier] = item._count || 0;
    });

    const response = {
      customersByTier: tierDistribution,
      pointsIssued: Math.abs(totalPointsIssued._sum.points || 0),
      pointsRedeemed: Math.abs(totalPointsRedeemed._sum.points || 0),
      activeOffers: activeOffersCount,
      topCustomers,
    };

    console.log("\n📊 Statistics Response:");
    console.log(JSON.stringify(response, null, 2));

    console.log("\n✅ Test complete!");
    console.log("\nExpected UI Display:");
    console.log(`  Total Points Issued: ${response.pointsIssued}`);
    console.log(`  Points Redeemed: ${response.pointsRedeemed}`);
    console.log(`  Active Offers: ${response.activeOffers}`);
    console.log(
      `  Redemption Rate: ${
        response.pointsIssued > 0 ? ((response.pointsRedeemed / response.pointsIssued) * 100).toFixed(1) : 0
      }%`
    );
    console.log(`\n  Customers by Tier:`);
    console.log(`    🥉 BRONZE: ${response.customersByTier.BRONZE}`);
    console.log(`    🥈 SILVER: ${response.customersByTier.SILVER}`);
    console.log(`    🥇 GOLD: ${response.customersByTier.GOLD}`);
    console.log(`    💎 PLATINUM: ${response.customersByTier.PLATINUM}`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testStatisticsEndpoint();
