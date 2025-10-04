const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

/**
 * Add sample loyalty points to customers for testing
 * This will create EARNED transactions and update customer balances
 */

async function addSamplePoints() {
  console.log("🎁 Adding sample loyalty points to customers...\n");

  try {
    // Get all customers
    const customers = await prisma.customer.findMany({
      select: { id: true, name: true, loyaltyPoints: true, loyaltyTier: true },
    });

    console.log(`Found ${customers.length} customers\n`);

    for (const customer of customers) {
      // Add 750 earned points (will put them in SILVER tier)
      const pointsToAdd = 750;

      // Create earned transaction
      await prisma.pointsTransaction.create({
        data: {
          customerId: customer.id,
          type: "EARNED",
          points: pointsToAdd,
          description: `Sample points - Initial balance for testing`,
        },
      });

      // Update customer balance and tier
      const newBalance = (customer.loyaltyPoints || 0) + pointsToAdd;
      const newTier = newBalance >= 1500 ? "GOLD" : newBalance >= 500 ? "SILVER" : "BRONZE";

      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          loyaltyPoints: newBalance,
          loyaltyTier: newTier,
        },
      });

      console.log(`✅ ${customer.name}:`);
      console.log(`   Added: ${pointsToAdd} points`);
      console.log(`   New balance: ${newBalance} points`);
      console.log(`   New tier: ${newTier}`);
      console.log("");
    }

    console.log("🎉 Sample points added successfully!");
    console.log("\nNow customers have:");
    console.log("- Earned points transactions");
    console.log("- Non-zero point balances");
    console.log("- Proper tier assignments");
    console.log("- Progress toward next tier");
  } catch (error) {
    console.error("❌ Error adding sample points:", error);
  } finally {
    await prisma.$disconnect();
  }
}

addSamplePoints();
