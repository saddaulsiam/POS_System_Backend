const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function quickTest() {
  console.log("\n🔍 DEBUGGING BIRTHDAY QUERY\n");

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  console.log(`Today's date: ${today.toDateString()}`);
  console.log(`Month: ${todayMonth}, Day: ${todayDay}\n`);

  // Check what customers have in the database
  console.log("📋 All customers with birthdays:\n");
  const allCustomers = await prisma.customer.findMany({
    where: { dateOfBirth: { not: null } },
    select: { id: true, name: true, dateOfBirth: true, loyaltyTier: true },
  });

  for (const c of allCustomers) {
    const bday = new Date(c.dateOfBirth);
    console.log(`  ${c.name}:`);
    console.log(`    Raw: ${c.dateOfBirth}`);
    console.log(`    Parsed: ${bday.toDateString()}`);
    console.log(`    Month: ${bday.getMonth() + 1}, Day: ${bday.getDate()}`);
    console.log(`    Tier: ${c.loyaltyTier}`);
    console.log();
  }

  // Run the SQL query
  console.log("🔍 Running SQL query:\n");
  const customers = await prisma.$queryRaw`
    SELECT * FROM Customer 
    WHERE isActive = 1 
    AND dateOfBirth IS NOT NULL
    AND CAST(strftime('%m', dateOfBirth) AS INTEGER) = ${todayMonth}
    AND CAST(strftime('%d', dateOfBirth) AS INTEGER) = ${todayDay}
  `;

  console.log(`Found ${customers.length} customers with birthdays today:`);
  console.log(JSON.stringify(customers, null, 2));

  await prisma.$disconnect();
}

quickTest();
