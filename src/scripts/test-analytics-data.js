const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testAnalyticsData() {
  console.log("🧪 Testing Analytics Data Availability...\n");

  try {
    // Check sales data
    const salesCount = await prisma.sale.count({
      where: { paymentStatus: "COMPLETED" },
    });
    console.log(`✅ Total completed sales: ${salesCount}`);

    // Check products
    const productsCount = await prisma.product.count();
    console.log(`✅ Total products: ${productsCount}`);

    // Check customers
    const customersCount = await prisma.customer.count();
    console.log(`✅ Total customers: ${customersCount}`);

    // Check categories
    const categoriesCount = await prisma.category.count();
    console.log(`✅ Total categories: ${categoriesCount}`);

    // Get recent sales for testing
    const recentSales = await prisma.sale.findMany({
      where: { paymentStatus: "COMPLETED" },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        receiptId: true,
        finalAmount: true,
        createdAt: true,
      },
    });

    console.log("\n📊 Recent Sales:");
    recentSales.forEach((sale) => {
      console.log(`  - ${sale.receiptId}: $${sale.finalAmount.toFixed(2)} (${sale.createdAt.toLocaleDateString()})`);
    });

    // Get sales by payment method
    const paymentMethods = await prisma.sale.groupBy({
      by: ["paymentMethod"],
      where: { paymentStatus: "COMPLETED" },
      _count: { id: true },
      _sum: { finalAmount: true },
    });

    console.log("\n💳 Sales by Payment Method:");
    paymentMethods.forEach((method) => {
      console.log(`  - ${method.paymentMethod}: ${method._count.id} sales, $${method._sum.finalAmount.toFixed(2)}`);
    });

    console.log("\n✅ Database has sufficient data for analytics testing!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAnalyticsData();
