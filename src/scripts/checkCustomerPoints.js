const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkCustomerPoints() {
  console.log("🔍 Checking customer loyalty data...\n");

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      loyaltyPoints: true,
      loyaltyTier: true,
    },
  });

  console.log("📊 Customers:");
  customers.forEach((c) => {
    console.log(`  ID ${c.id}: ${c.name} - ${c.loyaltyPoints} points (${c.loyaltyTier})`);
  });

  console.log("\n📜 Points Transactions:");
  const transactions = await prisma.pointsTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      customer: { select: { name: true } },
    },
  });

  transactions.forEach((t) => {
    console.log(`  ${t.customer.name}: ${t.points > 0 ? "+" : ""}${t.points} pts (${t.type}) - ${t.description || ""}`);
  });

  await prisma.$disconnect();
}

checkCustomerPoints();
