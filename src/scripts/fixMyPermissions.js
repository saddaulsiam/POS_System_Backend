const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function fixPermissions() {
  try {
    console.log("🔧 Updating saddaulsiam to ADMIN role...\n");

    const updated = await prisma.employee.update({
      where: { username: "saddaulsiam" },
      data: { role: "ADMIN" },
    });

    console.log("✅ SUCCESS!");
    console.log(`   ${updated.username} is now ${updated.role}\n`);
    console.log("📝 Next steps:");
    console.log("   1. Logout from the app");
    console.log("   2. Login again");
    console.log("   3. Access /loyalty-admin");
    console.log("   4. Everything should work now! 🎉\n");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixPermissions();
