/**
 * Reset Admin PIN to 1234
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function resetAdminPin() {
  try {
    console.log("🔄 Resetting admin PIN to 1234...");

    // Hash the new PIN
    const hashedPin = await bcrypt.hash("1234", 10);

    // Update admin user
    const admin = await prisma.employee.updateMany({
      where: { username: "admin" },
      data: { pinCode: hashedPin },
    });

    if (admin.count > 0) {
      console.log("\n✅ Admin PIN reset successfully!");
      console.log("=".repeat(50));
      console.log("📋 Login Credentials:");
      console.log("   Username: admin");
      console.log("   PIN Code: 1234");
      console.log("=".repeat(50));
    } else {
      console.log("\n❌ No admin user found!");
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPin();
