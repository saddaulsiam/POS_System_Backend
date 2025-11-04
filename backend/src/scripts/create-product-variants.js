import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function createProductWithVariants() {
  try {
    console.log("🧪 Creating test product with variants...\n");

    // Find or create a category
    let category = await prisma.category.findFirst({
      where: { name: "Beverages" },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: "Beverages",
        },
      });
      console.log("✅ Created Beverages category");
    }

    // Create the main product (parent)
    const product = await prisma.product.create({
      data: {
        name: "Premium Water Bottle",
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1762253769/pos/products/pqwcgpasm8cumjco4bhp.jpg",
        sku: "WATER-001",
        barcode: "8901234567890",
        description: "Premium filtered water in various sizes",
        categoryId: category.id,
        purchasePrice: 15.0,
        sellingPrice: 25.0,
        stockQuantity: 0, // Parent product has no stock (variants have stock)
        lowStockThreshold: 10,
        isWeighted: false,
        isActive: true,
        taxRate: 5.0,
        hasVariants: true, // Enable variants for this product
      },
    });

    console.log(`✅ Created product: ${product.name} (ID: ${product.id})\n`);

    // Create variants
    const variants = [
      {
        name: "500ml",
        sku: "WATER-001-500ML",
        barcode: "8901234567891",
        purchasePrice: 15.0,
        sellingPrice: 25.0,
        stockQuantity: 50,
      },
      {
        name: "1 Liter",
        sku: "WATER-001-1L",
        barcode: "8901234567892",
        purchasePrice: 25.0,
        sellingPrice: 40.0,
        stockQuantity: 40,
      },
      {
        name: "2 Liter",
        sku: "WATER-001-2L",
        barcode: "8901234567893",
        purchasePrice: 40.0,
        sellingPrice: 65.0,
        stockQuantity: 30,
      },
      {
        name: "5 Liter",
        sku: "WATER-001-5L",
        barcode: "8901234567894",
        purchasePrice: 80.0,
        sellingPrice: 120.0,
        stockQuantity: 20,
      },
    ];

    console.log("Creating variants:");
    for (const variantData of variants) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          ...variantData,
          isActive: true,
        },
      });
      console.log(`  ✅ ${variant.name} - ${variant.sku} (Stock: ${variant.stockQuantity})`);
    }

    console.log("\n🧪 Creating second product with variants...\n");

    // Create second product - Soft Drinks
    const product2 = await prisma.product.create({
      data: {
        name: "Cola Soft Drink",
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1762253769/pos/products/pqwcgpasm8cumjco4bhp.jpg",
        sku: "COLA-001",
        barcode: "890200" + Math.floor(Math.random() * 100000),
        description: "Refreshing cola drink in various sizes",
        categoryId: category.id,
        purchasePrice: 20.0,
        sellingPrice: 35.0,
        stockQuantity: 0,
        lowStockThreshold: 15,
        isWeighted: false,
        isActive: true,
        taxRate: 5.0,
        hasVariants: true,
      },
    });

    console.log(`✅ Created product: ${product2.name} (ID: ${product2.id})\n`);

    const variants2 = [
      {
        name: "250ml Can",
        sku: "COLA-001-250ML",
        barcode: "890201" + Math.floor(Math.random() * 100000),
        purchasePrice: 20.0,
        sellingPrice: 35.0,
        stockQuantity: 100,
      },
      {
        name: "330ml Can",
        sku: "COLA-001-330ML",
        barcode: "8901234567902",
        purchasePrice: 25.0,
        sellingPrice: 45.0,
        stockQuantity: 80,
      },
      {
        name: "500ml Bottle",
        sku: "COLA-001-500ML",
        barcode: "8901234567903",
        purchasePrice: 30.0,
        sellingPrice: 50.0,
        stockQuantity: 60,
      },
      {
        name: "1.5 Liter Bottle",
        sku: "COLA-001-1.5L",
        barcode: "8901234567904",
        purchasePrice: 50.0,
        sellingPrice: 80.0,
        stockQuantity: 40,
      },
      {
        name: "2 Liter Bottle",
        sku: "COLA-001-2L",
        barcode: "8901234567905",
        purchasePrice: 65.0,
        sellingPrice: 100.0,
        stockQuantity: 30,
      },
    ];

    console.log("Creating variants:");
    for (const variantData of variants2) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product2.id,
          ...variantData,
          isActive: true,
        },
      });
      console.log(`  ✅ ${variant.name} - ${variant.sku} (Stock: ${variant.stockQuantity})`);
    }

    console.log("\n🧪 Creating third product with variants...\n");

    // Find or create Snacks category
    let snacksCategory = await prisma.category.findFirst({
      where: { name: "Snacks" },
    });

    if (!snacksCategory) {
      snacksCategory = await prisma.category.create({
        data: {
          name: "Snacks",
        },
      });
      console.log("✅ Created Snacks category");
    }

    // Create third product - Potato Chips
    const product3 = await prisma.product.create({
      data: {
        name: "Crispy Potato Chips",
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1762253769/pos/products/pqwcgpasm8cumjco4bhp.jpg",
        sku: "CHIPS-001",
        barcode: "8901234567910",
        description: "Delicious crispy potato chips in different flavors and sizes",
        categoryId: snacksCategory.id,
        purchasePrice: 25.0,
        sellingPrice: 45.0,
        stockQuantity: 0,
        lowStockThreshold: 20,
        isWeighted: false,
        isActive: true,
        taxRate: 5.0,
        hasVariants: true,
      },
    });

    console.log(`✅ Created product: ${product3.name} (ID: ${product3.id})\n`);

    const variants3 = [
      {
        name: "50g - Original",
        sku: "CHIPS-001-50G-ORIG",
        barcode: "8901234567911",
        purchasePrice: 25.0,
        sellingPrice: 45.0,
        stockQuantity: 150,
      },
      {
        name: "50g - Spicy",
        sku: "CHIPS-001-50G-SPICY",
        barcode: "8901234567912",
        purchasePrice: 25.0,
        sellingPrice: 45.0,
        stockQuantity: 120,
      },
      {
        name: "100g - Original",
        sku: "CHIPS-001-100G-ORIG",
        barcode: "8901234567913",
        purchasePrice: 45.0,
        sellingPrice: 75.0,
        stockQuantity: 100,
      },
      {
        name: "100g - Spicy",
        sku: "CHIPS-001-100G-SPICY",
        barcode: "8901234567914",
        purchasePrice: 45.0,
        sellingPrice: 75.0,
        stockQuantity: 90,
      },
      {
        name: "200g - Family Pack",
        sku: "CHIPS-001-200G-FAMILY",
        barcode: "8901234567915",
        purchasePrice: 80.0,
        sellingPrice: 130.0,
        stockQuantity: 50,
      },
    ];

    console.log("Creating variants:");
    for (const variantData of variants3) {
      const variant = await prisma.productVariant.create({
        data: {
          productId: product3.id,
          ...variantData,
          isActive: true,
        },
      });
      console.log(`  ✅ ${variant.name} - ${variant.sku} (Stock: ${variant.stockQuantity})`);
    }

    console.log("\n✨ All products and variants created successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

createProductWithVariants();
