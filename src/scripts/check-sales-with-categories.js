const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkSalesWithCategories() {
  try {
    console.log("🔍 Checking Sales with Categories\n");
    
    // Get all completed sales
    const sales = await prisma.sale.findMany({
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
      take: 10,
    });

    console.log(`Found ${sales.length} completed sales\n`);

    sales.forEach((sale, index) => {
      console.log(`${index + 1}. Sale #${sale.receiptNumber || sale.id}`);
      console.log(`   Date: ${new Date(sale.createdAt).toLocaleString()}`);
      console.log(`   Total: $${sale.finalAmount.toFixed(2)}`);
      console.log(`   Items:`);
      
      sale.saleItems.forEach((item) => {
        const category = item.product.category?.name || "NO CATEGORY";
        console.log(`     - ${item.product.name} (${category}): Qty=${item.quantity}, Subtotal=$${item.subtotal.toFixed(2)}`);
      });
      console.log("");
    });

    // Check if any products don't have categories
    const productsWithoutCategories = await prisma.product.findMany({
      where: {
        category: null,
      },
    });

    if (productsWithoutCategories.length > 0) {
      console.log(`⚠️  WARNING: ${productsWithoutCategories.length} products have no category!`);
    } else {
      console.log("✅ All products have categories");
    }

    // Check date range
    if (sales.length > 0) {
      const oldest = new Date(sales[sales.length - 1].createdAt);
      const newest = new Date(sales[0].createdAt);
      console.log(`\n📅 Sales date range: ${oldest.toLocaleDateString()} to ${newest.toLocaleDateString()}`);
    }

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSalesWithCategories();
