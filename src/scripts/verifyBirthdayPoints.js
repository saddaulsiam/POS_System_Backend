const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function verifyPoints() {
  console.log("\n✅ VERIFICATION: Points After Birthday Rewards\n");

  const customers = await prisma.customer.findMany({
    where: { id: { in: [1, 2, 3] } },
    select: {
      id: true,
      name: true,
      loyaltyPoints: true,
      loyaltyTier: true,
    },
  });

  console.log("Current Customer Points:");
  for (const c of customers) {
    console.log(`  ${c.name} (${c.loyaltyTier}): ${c.loyaltyPoints} points`);
  }

  console.log("\n📜 Recent Birthday Transactions:\n");
  const transactions = await prisma.pointsTransaction.findMany({
    where: {
      customerId: { in: [1, 2, 3] },
      type: "BIRTHDAY_BONUS",
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      customer: { select: { name: true } },
    },
  });

  for (const tx of transactions) {
    console.log(`  🎂 ${tx.customer.name}: +${tx.points} pts`);
    console.log(`     ${tx.description}`);
    console.log(`     ${tx.createdAt.toLocaleString()}\n`);
  }

  await prisma.$disconnect();
}

verifyPoints();
