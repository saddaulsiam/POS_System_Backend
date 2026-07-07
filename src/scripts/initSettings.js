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
