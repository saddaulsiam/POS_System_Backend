const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testCustomers() {
  try {
    console.log("🔍 Checking Customers...\n");

    // Get total customers
    const totalCustomers = await prisma.customer.count();
    console.log(`📊 Total Customers: ${totalCustomers}`);

    // Get active customers
    const activeCustomers = await prisma.customer.count({ where: { isActive: true } });
    console.log(`✅ Active Customers: ${activeCustomers}`);

    // Get inactive customers
    const inactiveCustomers = await prisma.customer.count({ where: { isActive: false } });
    console.log(`❌ Inactive Customers: ${inactiveCustomers}\n`);

    // Get all customers with details
    const customers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (customers.length === 0) {
      console.log("❗ No customers found in database!");
    } else {
      console.log("📋 Customer List:");
      customers.forEach((c) => {
        const status = c.isActive ? "✅" : "❌";
        console.log(
          `   ${status} ${c.id}: ${c.name} (${c.phoneNumber}) - Created: ${c.createdAt.toLocaleDateString()}`
        );
      });
    }

    // Test the API query
    console.log("\n🔍 Testing API Query (isActive: true):");
    const apiCustomers = await prisma.customer.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      take: 5,
    });
    console.log(`   Found ${apiCustomers.length} customers`);
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testCustomers();
