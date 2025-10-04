const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testLoyalty() {
  console.log("🔍 Testing Loyalty System...\n");

  try {
    // Test 1: Check tier configuration
    console.log("1️⃣ Checking Loyalty Tier Configuration...");
    const tiers = await prisma.loyaltyTierConfig.findMany({
      orderBy: { minimumPoints: "asc" },
    });
    console.log(`   Found ${tiers.length} tiers in database`);
    tiers.forEach((tier) => {
      console.log(`   - ${tier.tier}: ${tier.minimumPoints} pts, ${tier.pointsMultiplier}x multiplier`);
    });

    // Test 2: Check customers with loyalty points
    console.log("\n2️⃣ Checking Customers...");
    const customers = await prisma.customer.findMany({
      where: { loyaltyPoints: { gt: 0 } },
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        loyaltyTier: true,
      },
      take: 5,
    });
    console.log(`   Found ${customers.length} customers with loyalty points`);
    customers.forEach((c) => {
      console.log(`   - ${c.name}: ${c.loyaltyPoints} pts (${c.loyaltyTier})`);
    });

    // Test 3: Check points transactions
    console.log("\n3️⃣ Checking Points Transactions...");
    const transactions = await prisma.pointsTransaction.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
      },
    });
    console.log(`   Found ${transactions.length} recent transactions`);
    transactions.forEach((t) => {
      console.log(`   - ${t.customer.name}: ${t.points} pts (${t.type})`);
    });

    // Test 4: Check loyalty offers
    console.log("\n4️⃣ Checking Loyalty Offers...");
    const offers = await prisma.loyaltyOffer.findMany({
      where: { isActive: true },
    });
    console.log(`   Found ${offers.length} active offers`);
    offers.forEach((o) => {
      console.log(`   - ${o.title}: ${o.offerType} (${o.requiredTier}+)`);
    });

    // Test 5: Check loyalty rewards
    console.log("\n5️⃣ Checking Loyalty Rewards...");
    const rewards = await prisma.loyaltyReward.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        customer: { select: { name: true } },
      },
    });
    console.log(`   Found ${rewards.length} recent rewards`);
    rewards.forEach((r) => {
      console.log(`   - ${r.customer.name}: ${r.rewardType} (${r.pointsCost} pts)`);
    });

    // Test 6: Statistics
    console.log("\n6️⃣ Calculating Statistics...");
    const totalCustomers = await prisma.customer.count();
    const customersByTier = await prisma.customer.groupBy({
      by: ["loyaltyTier"],
      _count: true,
    });
    console.log(`   Total customers: ${totalCustomers}`);
    customersByTier.forEach((ct) => {
      console.log(`   - ${ct.loyaltyTier}: ${ct._count} customers`);
    });

    const allTransactions = await prisma.pointsTransaction.findMany({
      select: { type: true, points: true },
    });
    const pointsIssued = allTransactions.filter((t) => t.type === "EARNED").reduce((sum, t) => sum + t.points, 0);
    const pointsRedeemed = Math.abs(
      allTransactions.filter((t) => t.type === "REDEEMED").reduce((sum, t) => sum + t.points, 0)
    );
    console.log(`   Points issued: ${pointsIssued}`);
    console.log(`   Points redeemed: ${pointsRedeemed}`);
    console.log(`   Redemption rate: ${((pointsRedeemed / pointsIssued) * 100).toFixed(1)}%`);

    console.log("\n✅ All loyalty system checks completed!");
  } catch (error) {
    console.error("\n❌ Error testing loyalty system:", error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testLoyalty();
