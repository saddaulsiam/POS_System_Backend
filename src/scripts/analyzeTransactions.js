const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkTransactionCalculations() {
  try {
    console.log("🔍 Checking transaction calculations for all customers...\n");

    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
      },
    });

    for (const customer of customers) {
      console.log("=".repeat(80));
      console.log(`\nCustomer: ${customer.name} (ID: ${customer.id})`);
      console.log(`Current Database Balance: ${customer.loyaltyPoints} points\n`);

      const transactions = await prisma.pointsTransaction.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          points: true,
          description: true,
          createdAt: true,
        },
      });

      if (transactions.length === 0) {
        console.log("  No transactions found.\n");
        continue;
      }

      console.log(`Transaction History (${transactions.length} transactions):`);
      console.log("-".repeat(80));

      let runningBalance = 0;
      transactions.forEach((t, index) => {
        runningBalance += t.points;
        const sign = t.points > 0 ? "+" : "";
        console.log(
          `${(index + 1).toString().padStart(2)}. ${t.createdAt.toLocaleDateString().padEnd(12)} | ${t.type.padEnd(
            15
          )} | ${(sign + t.points).padStart(6)} pts | Balance: ${runningBalance.toString().padStart(6)} | ${
            t.description || "N/A"
          }`
        );
      });

      // Calculate summary statistics (same as frontend)
      const totalPoints = transactions.reduce((sum, t) => sum + t.points, 0);
      const earnedPoints = transactions.filter((t) => t.points > 0).reduce((sum, t) => sum + t.points, 0);

      // OLD WAY (potentially wrong):
      const redeemedPointsOld = transactions
        .filter((t) => t.points < 0)
        .reduce((sum, t) => sum + Math.abs(t.points), 0);

      // NEW WAY (correct):
      const redeemedPointsNew = Math.abs(
        transactions.filter((t) => t.points < 0).reduce((sum, t) => sum + t.points, 0)
      );

      console.log(`\n📊 Summary Statistics:`);
      console.log(`  Total Earned:     +${earnedPoints}`);
      console.log(`  Total Redeemed:   -${redeemedPointsNew} (using new method)`);
      console.log(
        `  Total Redeemed:   -${redeemedPointsOld} (using old method) ${
          redeemedPointsOld !== redeemedPointsNew ? "⚠️ DIFFERENT!" : ""
        }`
      );
      console.log(`  Net Balance:      ${totalPoints}`);
      console.log(`  Database Balance: ${customer.loyaltyPoints}`);
      console.log(`  Running Balance:  ${runningBalance}`);

      if (totalPoints !== customer.loyaltyPoints) {
        console.log(`  ⚠️  MISMATCH between calculated (${totalPoints}) and stored (${customer.loyaltyPoints})!`);
      }
      if (runningBalance !== customer.loyaltyPoints) {
        console.log(
          `  ⚠️  MISMATCH between running balance (${runningBalance}) and stored (${customer.loyaltyPoints})!`
        );
      }

      console.log();
    }

    console.log("=".repeat(80));
    console.log("\n✅ Analysis complete!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransactionCalculations();
