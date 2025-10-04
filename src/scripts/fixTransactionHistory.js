const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function fixTransactionHistory() {
  try {
    console.log("🔧 Fixing transaction history to match customer balances...\n");

    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
      },
    });

    for (const customer of customers) {
      const transactions = await prisma.pointsTransaction.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "asc" },
      });

      // Calculate what the balance SHOULD be based on transactions
      const calculatedBalance = transactions.reduce((sum, t) => sum + t.points, 0);
      const actualBalance = customer.loyaltyPoints;

      if (calculatedBalance !== actualBalance) {
        const difference = actualBalance - calculatedBalance;

        console.log(`\n❌ Found mismatch for ${customer.name} (ID: ${customer.id})`);
        console.log(`   Database Balance: ${actualBalance}`);
        console.log(`   Calculated from Transactions: ${calculatedBalance}`);
        console.log(`   Difference: ${difference}\n`);

        if (difference > 0) {
          // Customer has more points than transactions show - add EARNED transaction
          console.log(`   ➕ Adding EARNED transaction for +${difference} points to correct history...`);

          await prisma.pointsTransaction.create({
            data: {
              customerId: customer.id,
              type: "ADJUSTED",
              points: difference,
              description: `Balance correction - historical points not in transaction log`,
              createdAt: new Date(transactions[0]?.createdAt || new Date()), // Date it before first transaction
            },
          });

          console.log(`   ✅ Added correction transaction`);
        } else if (difference < 0) {
          // Customer has fewer points than transactions show - this is weird!
          console.log(`   ⚠️  WARNING: Customer has FEWER points than transaction history indicates!`);
          console.log(`      This suggests points were removed without creating a transaction.`);
          console.log(`      Adding ADJUSTED transaction for ${difference} points...`);

          await prisma.pointsTransaction.create({
            data: {
              customerId: customer.id,
              type: "ADJUSTED",
              points: difference,
              description: `Balance correction - points deducted without transaction record`,
            },
          });

          console.log(`   ✅ Added correction transaction`);
        }
      } else {
        console.log(`✅ ${customer.name} (ID: ${customer.id}) - Balance matches (${actualBalance} points)`);
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("\n🎉 Transaction history has been corrected!");
    console.log("\nVerifying fixes...\n");

    // Verify all customers now have matching balances
    for (const customer of customers) {
      const transactions = await prisma.pointsTransaction.findMany({
        where: { customerId: customer.id },
      });

      const calculatedBalance = transactions.reduce((sum, t) => sum + t.points, 0);
      const actualBalance = customer.loyaltyPoints;
      const match = calculatedBalance === actualBalance ? "✅" : "❌";

      console.log(`${match} ${customer.name}: DB=${actualBalance}, Calculated=${calculatedBalance}`);
    }

    console.log("\n✅ All done!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixTransactionHistory();
