import prisma from "../prisma.js";

/**
 * Ensures the SystemSettings row (id=1) exists in the database.
 * Called once at application startup. If the record doesn't exist,
 * it creates it with safe default values.
 */
export async function ensureSystemSettings() {
  try {
    await prisma.systemSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        defaultTrialDays: 10,
        monthlyPrice: 79.0,
        yearlyPrice: 59.0,
        supportEmail: "support@pos-platform.com",
      },
      update: {}, // Never overwrite existing settings on startup
    });
    console.log("✅ SystemSettings initialized");
  } catch (error) {
    console.error("❌ Failed to initialize SystemSettings:", error.message);
  }
}
