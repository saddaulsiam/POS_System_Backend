const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function testCategoryBreakdown() {
  try {
    console.log("🧪 Testing Category Breakdown Logic\n");
    console.log("=".repeat(60));

    // Get today's date range
    const startDate = new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = new Date(new Date().setHours(23, 59, 59, 999));

    console.log(`\n📅 Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);

    // Get sale items
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          paymentStatus: "COMPLETED",
        },
      },
      include: {
        product: {
          select: {
            name: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    console.log(`✅ Found ${saleItems.length} sale items\n`);

    if (saleItems.length === 0) {
      console.log("⚠️  No sale items found for today!");
      console.log("\nLet's check all completed sales...\n");

      const allSales = await prisma.sale.findMany({
        where: {
          paymentStatus: "COMPLETED",
        },
        include: {
          saleItems: {
            include: {
              product: {
                select: {
                  name: true,
                  category: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      });

      console.log(`📊 Recent completed sales: ${allSales.length}\n`);

      allSales.forEach((sale, index) => {
        console.log(`${index + 1}. Sale #${sale.receiptNumber || sale.id}`);
        console.log(`   Date: ${new Date(sale.createdAt).toLocaleString()}`);
        console.log(`   Items: ${sale.saleItems.length}`);
        console.log(`   Total: $${sale.finalAmount.toFixed(2)}`);

        sale.saleItems.forEach((item, i) => {
          const categoryName = item.product?.category?.name || "No Category";
          console.log(
            `     ${i + 1}. ${item.product?.name || "Unknown"} (${categoryName}) - $${item.subtotal.toFixed(2)}`
          );
        });
        console.log("");
      });

      // Test with broader date range
      console.log("\n🔍 Testing with ALL TIME data...\n");

      const allTimeItems = await prisma.saleItem.findMany({
        where: {
          sale: {
            paymentStatus: "COMPLETED",
          },
        },
        include: {
          product: {
            select: {
              name: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      console.log(`✅ Found ${allTimeItems.length} sale items (all time)\n`);

      if (allTimeItems.length > 0) {
        // Group by category
        const categoryStats = {};

        allTimeItems.forEach((item) => {
          const categoryName = item.product?.category?.name || "Uncategorized";

          if (!categoryStats[categoryName]) {
            categoryStats[categoryName] = {
              categoryId: item.product?.category?.id || 0,
              name: categoryName,
              revenue: 0,
              quantity: 0,
              itemCount: 0,
            };
          }

          categoryStats[categoryName].revenue += item.subtotal;
          categoryStats[categoryName].quantity += item.quantity;
          categoryStats[categoryName].itemCount += 1;
        });

        const totalRevenue = Object.values(categoryStats).reduce((sum, cat) => sum + cat.revenue, 0);

        // Calculate percentages
        const categories = Object.values(categoryStats)
          .map((cat) => ({
            ...cat,
            percentage: totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue);

        console.log("📊 Category Breakdown (All Time):\n");
        console.log(`💰 Total Revenue: $${totalRevenue.toFixed(2)}\n`);

        categories.forEach((cat, index) => {
          console.log(`${index + 1}. ${cat.name}`);
          console.log(`   Revenue: $${cat.revenue.toFixed(2)} (${cat.percentage.toFixed(1)}%)`);
          console.log(`   Items Sold: ${cat.quantity}`);
          console.log(`   Transactions: ${cat.itemCount}`);
          console.log("");
        });

        console.log("=".repeat(60));
        console.log("✅ Category breakdown data structure is correct!");
        console.log("⚠️  Issue: Using 'today' period may have no data");
        console.log("💡 Solution: Test with broader date range (week/month)");
      }
    } else {
      // Process today's data
      const categoryStats = {};

      saleItems.forEach((item) => {
        const categoryName = item.product?.category?.name || "Uncategorized";

        if (!categoryStats[categoryName]) {
          categoryStats[categoryName] = {
            categoryId: item.product?.category?.id || 0,
            name: categoryName,
            revenue: 0,
            quantity: 0,
            itemCount: 0,
          };
        }

        categoryStats[categoryName].revenue += item.subtotal;
        categoryStats[categoryName].quantity += item.quantity;
        categoryStats[categoryName].itemCount += 1;
      });

      const totalRevenue = Object.values(categoryStats).reduce((sum, cat) => sum + cat.revenue, 0);

      const categories = Object.values(categoryStats)
        .map((cat) => ({
          ...cat,
          percentage: totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      console.log("📊 Category Breakdown (Today):\n");
      console.log(`💰 Total Revenue: $${totalRevenue.toFixed(2)}\n`);

      categories.forEach((cat, index) => {
        console.log(`${index + 1}. ${cat.name}`);
        console.log(`   Revenue: $${cat.revenue.toFixed(2)} (${cat.percentage.toFixed(1)}%)`);
        console.log(`   Items Sold: ${cat.quantity}`);
        console.log(`   Transactions: ${cat.itemCount}`);
        console.log("");
      });

      console.log("=".repeat(60));
      console.log("✅ Category breakdown working correctly!");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testCategoryBreakdown();
