import prisma from "../prisma.js";

/**
 * Initializes global platform system settings if they do not already exist.
 */
export async function initializeSettings() {
  try {
    await prisma.systemSettings.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        defaultTrialDays: 10,
        monthlyPrice: 79.0,
        yearlyPrice: 59.0,
        supportEmail: "support@pos-platform.com",
      },
    });
    console.log("🌱 System settings initialized.");
  } catch (err) {
    console.error("❌ Failed to initialize system settings:", err.message);
  }
}

/**
 * Automatically synchronizes parent product stock levels with the sum of their variants' stocks.
 */
export async function syncAllProductStocks() {
  try {
    const productsWithVariants = await prisma.product.findMany({
      where: { hasVariants: true },
      include: { variants: true }
    });
    let syncedCount = 0;
    for (const product of productsWithVariants) {
      const totalVariantStock = product.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
      if (product.stockQuantity !== totalVariantStock) {
        await prisma.product.update({
          where: { id: product.id },
          data: { stockQuantity: totalVariantStock }
        });
        syncedCount++;
      }
    }
    if (syncedCount > 0) {
      console.log(`✅ Dynamically synchronized stock levels for ${syncedCount} parent products with variants.`);
    }
  } catch (err) {
    console.error("❌ Failed to synchronize product stock levels:", err.message);
  }
}
