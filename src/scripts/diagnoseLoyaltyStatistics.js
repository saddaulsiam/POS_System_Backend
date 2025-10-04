const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function diagnoseLoyaltyStatistics() {
  try {
    console.log("🔍 Diagnosing Loyalty Statistics Issues...\n");
    console.log("=".repeat(80));

    // 1. Check Customers by Tier
    console.log("\n1️⃣ CUSTOMERS BY TIER\n");

    const customersByTier = await prisma.customer.groupBy({
      by: ["loyaltyTier"],
      where: { isActive: true },
      _count: true,
    });

    console.log("Raw groupBy result:", JSON.stringify(customersByTier, null, 2));

    const allCustomers = await prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true, loyaltyTier: true, isActive: true },
    });

    console.log(`\nTotal active customers: ${allCustomers.length}`);
    allCustomers.forEach((c) => {
      console.log(`  - ${c.name} (ID: ${c.id}): ${c.loyaltyTier}`);
    });

    // Manual count
    const manualCount = {
      BRONZE: allCustomers.filter((c) => c.loyaltyTier === "BRONZE").length,
      SILVER: allCustomers.filter((c) => c.loyaltyTier === "SILVER").length,
      GOLD: allCustomers.filter((c) => c.loyaltyTier === "GOLD").length,
      PLATINUM: allCustomers.filter((c) => c.loyaltyTier === "PLATINUM").length,
    };

    console.log("\nManual count by tier:");
    console.log(JSON.stringify(manualCount, null, 2));

    // 2. Check Points Issued
    console.log("\n" + "=".repeat(80));
    console.log("\n2️⃣ POINTS ISSUED (EARNED)\n");

    const earnedTransactions = await prisma.pointsTransaction.findMany({
      where: { type: "EARNED" },
      select: { id: true, customerId: true, points: true, description: true },
    });

    console.log(`Total EARNED transactions: ${earnedTransactions.length}`);
    earnedTransactions.forEach((t) => {
      console.log(`  - Customer ${t.customerId}: +${t.points} (${t.description})`);
    });

    const totalPointsIssued = await prisma.pointsTransaction.aggregate({
      where: { type: "EARNED" },
      _sum: { points: true },
    });

    console.log(`\nTotal Points Issued (EARNED): ${totalPointsIssued._sum.points || 0}`);

    // Also check ALL positive transactions
    const allPositive = await prisma.pointsTransaction.aggregate({
      where: { points: { gt: 0 } },
      _sum: { points: true },
    });

    console.log(`Total Points Issued (ALL POSITIVE): ${allPositive._sum.points || 0}`);

    // 3. Check Points Redeemed
    console.log("\n" + "=".repeat(80));
    console.log("\n3️⃣ POINTS REDEEMED\n");

    const redeemedTransactions = await prisma.pointsTransaction.findMany({
      where: { type: "REDEEMED" },
      select: { id: true, customerId: true, points: true, description: true },
    });

    console.log(`Total REDEEMED transactions: ${redeemedTransactions.length}`);
    redeemedTransactions.forEach((t) => {
      console.log(`  - Customer ${t.customerId}: ${t.points} (${t.description})`);
    });

    const totalPointsRedeemed = await prisma.pointsTransaction.aggregate({
      where: { type: "REDEEMED" },
      _sum: { points: true },
    });

    console.log(`\nTotal Points Redeemed: ${Math.abs(totalPointsRedeemed._sum.points || 0)}`);

    // 4. Check Active Offers
    console.log("\n" + "=".repeat(80));
    console.log("\n4️⃣ ACTIVE OFFERS\n");

    const now = new Date();
    const activeOffers = await prisma.loyaltyOffer.findMany({
      where: {
        isActive: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: { id: true, title: true, startDate: true, endDate: true },
    });

    console.log(`Active offers: ${activeOffers.length}`);
    activeOffers.forEach((o) => {
      console.log(`  - ${o.title} (${o.startDate.toLocaleDateString()} - ${o.endDate.toLocaleDateString()})`);
    });

    // 5. Check Top Customers
    console.log("\n" + "=".repeat(80));
    console.log("\n5️⃣ TOP CUSTOMERS\n");

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

    console.log("Top customers by loyalty points:");
    topCustomers.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.name} - ${c.loyaltyTier} - ${c.loyaltyPoints} points`);
    });

    // 6. Summary
    console.log("\n" + "=".repeat(80));
    console.log("\n📊 SUMMARY FOR ADMIN PAGE\n");

    console.log("Expected Statistics Response:");
    console.log(
      JSON.stringify(
        {
          customersByTier: manualCount,
          pointsIssued: allPositive._sum.points || 0,
          pointsRedeemed: Math.abs(totalPointsRedeemed._sum.points || 0),
          activeOffers: activeOffers.length,
          topCustomersCount: topCustomers.length,
        },
        null,
        2
      )
    );

    console.log("\n✅ Diagnostic complete!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseLoyaltyStatistics();
