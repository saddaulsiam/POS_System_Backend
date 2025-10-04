const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkQuickSaleItems() {
  try {
    console.log("\n🔍 Checking Quick Sale Items Setup...\n");

    // 1. Check if QuickSaleItem table exists and has data
    const quickItems = await prisma.quickSaleItem.findMany({
      include: {
        product: true,
      },
    });

    console.log(`📊 Total Quick Sale Items: ${quickItems.length}`);

    if (quickItems.length === 0) {
      console.log("\n⚠️  No quick sale items found in database");
      console.log("\n💡 To add quick sale items:");
      console.log("   1. Go to Products page");
      console.log("   2. Click on a product");
      console.log("   3. Use 'Add to Quick Sale' option");
      console.log("   4. Choose a color and save");

      // Let's check if there are any products available
      const products = await prisma.product.findMany({
        where: { isActive: true },
        take: 5,
      });

      console.log(`\n📦 Available Products (showing first 5):`);
      products.forEach((p) => {
        console.log(`   - ${p.name} (ID: ${p.id}) - $${p.sellingPrice}`);
      });

      if (products.length > 0) {
        console.log("\n✅ You have products available to add as quick sale items");
        console.log("\n🚀 Creating sample quick sale items...");

        // Create 3 sample quick sale items
        const sampleColors = ["#3B82F6", "#10B981", "#F59E0B"];
        for (let i = 0; i < Math.min(3, products.length); i++) {
          const product = products[i];
          await prisma.quickSaleItem.create({
            data: {
              productId: product.id,
              displayName: product.name,
              color: sampleColors[i],
              sortOrder: i,
              isActive: true,
            },
          });
          console.log(`   ✓ Created: ${product.name} (${sampleColors[i]})`);
        }

        console.log("\n✅ Sample quick sale items created!");
        console.log("🔄 Refresh your POS page to see them");
      }
    } else {
      console.log("\n✅ Quick Sale Items Found:\n");
      quickItems.forEach((item, index) => {
        console.log(`${index + 1}. ${item.displayName}`);
        console.log(`   Product: ${item.product?.name || "N/A"}`);
        console.log(`   Color: ${item.color}`);
        console.log(`   Active: ${item.isActive ? "✓" : "✗"}`);
        console.log(`   Sort Order: ${item.sortOrder}`);
        console.log("");
      });
    }

    // 2. Test API endpoint simulation
    const activeItems = quickItems.filter((item) => item.isActive);
    console.log(`\n🔌 API would return ${activeItems.length} active items`);

    console.log("\n✅ Quick Sale Items check complete!");
  } catch (error) {
    console.error("\n❌ Error checking quick sale items:", error);
    console.error("\nError details:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkQuickSaleItems();
