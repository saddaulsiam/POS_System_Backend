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
 * Automatically synchronizes parent product stock levels with the sum
 * of their variants' stocks.
 *
 * Runs after a short delay so it doesn't compete with the first wave of
 * incoming user requests and overwhelm Neon's connection pooler.
 */
export async function syncAllProductStocks() {
  // Wait 10 seconds after server start before touching the DB.
  // This ensures normal API requests get DB connections first.
  await new Promise((resolve) => setTimeout(resolve, 10_000));

  try {
    const productsWithVariants = await prisma.product.findMany({
      where: { hasVariants: true },
      select: {
        id: true,
        stockQuantity: true,
        variants: { select: { stockQuantity: true } },
      },
    });

    // Build list of products whose stock is actually out of sync
    const toUpdate = productsWithVariants
      .map((p) => ({
        id: p.id,
        total: p.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0),
        current: p.stockQuantity,
      }))
      .filter((p) => p.current !== p.total);

    if (toUpdate.length === 0) {
      console.log("✅ All product stock levels are already in sync.");
      return;
    }

    // Run all updates in a single transaction to use one DB connection
    await prisma.$transaction(
      toUpdate.map((p) =>
        prisma.product.update({
          where: { id: p.id },
          data: { stockQuantity: p.total },
        }),
      ),
    );

    console.log(
      `✅ Synchronized stock for ${toUpdate.length} variant product(s).`,
    );
  } catch (err) {
    console.error("❌ Failed to synchronize product stock levels:", err.message);
  }
}
