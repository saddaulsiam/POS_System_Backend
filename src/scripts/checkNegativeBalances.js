const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkNegativeBalances() {
  try {
    console.log("🔍 Checking for customers with negative loyalty point balances...\n");

    // Get all customers with their points
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        loyaltyTier: true,
      },
      orderBy: {
        loyaltyPoints: "asc", // Show lowest (most negative) first
      },
    });

    console.log(`Total customers: ${customers.length}\n`);

    // Find customers with negative or zero points
    const negativeBalances = customers.filter((c) => c.loyaltyPoints < 0);
    const zeroBalances = customers.filter((c) => c.loyaltyPoints === 0);
    const positiveBalances = customers.filter((c) => c.loyaltyPoints > 0);

    console.log("📊 Balance Distribution:");
    console.log(`  Negative: ${negativeBalances.length} customers`);
    console.log(`  Zero: ${zeroBalances.length} customers`);
    console.log(`  Positive: ${positiveBalances.length} customers\n`);

    if (negativeBalances.length > 0) {
      console.log("❌ Customers with NEGATIVE balances (data integrity issue!):");
      console.log("=".repeat(80));

      for (const customer of negativeBalances) {
        console.log(`\nCustomer ID: ${customer.id}`);
        console.log(`Name: ${customer.name}`);
        console.log(`Current Balance: ${customer.loyaltyPoints} points`);
        console.log(`Tier: ${customer.loyaltyTier}`);

        // Get transaction history
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

        console.log(`\nTransaction History (${transactions.length} transactions):`);
        let runningBalance = 0;

        transactions.forEach((t, index) => {
          runningBalance += t.points;
          console.log(
            `  ${index + 1}. ${t.type.padEnd(15)} | ${t.points.toString().padStart(5)} pts | Balance: ${runningBalance
              .toString()
              .padStart(5)} | ${t.createdAt.toLocaleDateString()} | ${t.description || "N/A"}`
          );
        });

        // Calculate totals
        const earned = transactions.filter((t) => t.points > 0).reduce((sum, t) => sum + t.points, 0);
        const redeemed = Math.abs(transactions.filter((t) => t.points < 0).reduce((sum, t) => sum + t.points, 0));

        console.log(`\n  Summary:`);
        console.log(`    Earned: +${earned}`);
        console.log(`    Redeemed: -${redeemed}`);
        console.log(`    Net: ${earned - redeemed}`);
        console.log(`    Database Balance: ${customer.loyaltyPoints}`);

        if (runningBalance !== customer.loyaltyPoints) {
          console.log(`    ⚠️  MISMATCH! Calculated: ${runningBalance}, Stored: ${customer.loyaltyPoints}`);
        }
      }
    }

    // Show summary for all customers
    console.log("\n" + "=".repeat(80));
    console.log("\n📋 All Customers Summary:");
    console.log("ID | Name                    | Points  | Tier     ");
    console.log("-".repeat(80));

    customers.forEach((c) => {
      const pointsDisplay = c.loyaltyPoints.toString().padStart(7);
      const indicator = c.loyaltyPoints < 0 ? "❌" : c.loyaltyPoints === 0 ? "⚪" : "✅";
      console.log(
        `${indicator} ${c.id.toString().padStart(2)} | ${c.name.padEnd(23)} | ${pointsDisplay} | ${c.loyaltyTier}`
      );
    });

    console.log("\n✅ Check complete!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkNegativeBalances();
