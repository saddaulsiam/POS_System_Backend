/**
 * Create Admin User Script
 * Creates a default admin user for the POS system
 */

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log("🔄 Creating admin user...");

    // Hash the PIN
    const hashedPin = await bcrypt.hash("1234", 10);

    // Create admin user
    const admin = await prisma.employee.create({
      data: {
        name: "Admin User",
        username: "admin",
        pinCode: hashedPin,
        role: "ADMIN",
        isActive: true,
      },
    });

    console.log("\n✅ Admin user created successfully!");
    console.log("=".repeat(50));
    console.log("📋 Login Credentials:");
    console.log("   Username: admin");
    console.log("   PIN Code: 1234");
    console.log("=".repeat(50));
    console.log("\n🎉 You can now login to your POS system!");
  } catch (error) {
    if (error.code === "P2002") {
      console.log("\nℹ️  Admin user already exists!");
      console.log("=".repeat(50));
      console.log("📋 Login Credentials:");
      console.log("   Username: admin");
      console.log("   PIN Code: 1234");
      console.log("=".repeat(50));
    } else {
      console.error("\n❌ Error creating admin user:", error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
createAdmin()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
