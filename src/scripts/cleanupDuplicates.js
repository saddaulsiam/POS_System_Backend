const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function cleanupDuplicates() {
  console.log("\n🧹 Cleaning up duplicate birthday bonuses...\n");

  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    // Get all birthday bonuses from today
    const todayBonuses = await prisma.pointsTransaction.findMany({
      where: {
        type: "BIRTHDAY_BONUS",
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { createdAt: "asc" },
      include: { customer: true },
    });

    console.log(`Found ${todayBonuses.length} birthday bonus transactions today\n`);

    // Group by customer
    const byCustomer = {};
    for (const tx of todayBonuses) {
      if (!byCustomer[tx.customerId]) {
        byCustomer[tx.customerId] = [];
      }
      byCustomer[tx.customerId].push(tx);
    }

    // Find duplicates
    const toDelete = [];
    for (const customerId in byCustomer) {
      const transactions = byCustomer[customerId];
      if (transactions.length > 1) {
        console.log(`❌ Customer ${transactions[0].customer.name} has ${transactions.length} bonuses:`);
        // Keep the first one, delete the rest
        for (let i = 1; i < transactions.length; i++) {
          console.log(
            `   Removing duplicate: +${transactions[i].points}pts at ${transactions[i].createdAt.toLocaleTimeString()}`
          );
          toDelete.push(transactions[i]);
        }
        console.log();
      }
    }

    if (toDelete.length === 0) {
      console.log("✅ No duplicates found!\n");
      return;
    }

    console.log(`🗑️  Removing ${toDelete.length} duplicate transactions...\n`);

    // Delete duplicates and reverse points
    for (const tx of toDelete) {
      // Remove points from customer
      await prisma.customer.update({
        where: { id: tx.customerId },
        data: { loyaltyPoints: { decrement: tx.points } },
      });

      // Delete the transaction
      await prisma.pointsTransaction.delete({
        where: { id: tx.id },
      });

      console.log(`   ✓ Removed duplicate for ${tx.customer.name}: -${tx.points}pts`);
    }

    console.log("\n✅ Cleanup complete!\n");

    // Show final state
    console.log("📊 Final customer points:\n");
    const customers = await prisma.customer.findMany({
      where: { id: { in: Object.keys(byCustomer).map(Number) } },
    });

    for (const c of customers) {
      console.log(`   ${c.name}: ${c.loyaltyPoints} points`);
    }
    console.log();
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupDuplicates();
