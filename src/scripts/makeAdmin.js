/**
 * Update Employee Role to ADMIN
 * Use this to grant admin access to a user
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function updateToAdmin() {
  const username = process.argv[2];

  if (!username) {
    console.log("❌ No username provided!");
    console.log("\nUsage: node makeAdmin.js <username>");
    console.log("\nExample: node makeAdmin.js saddaulsiam");
    console.log("\nAvailable users:");

    const users = await prisma.employee.findMany({
      select: { id: true, username: true, name: true, role: true },
    });

    users.forEach((u) => {
      console.log(`   - ${u.username} (${u.name}) - Current role: ${u.role}`);
    });

    await prisma.$disconnect();
    process.exit(1);
  }

  try {
    console.log(`🔍 Looking for user: ${username}\n`);

    const employee = await prisma.employee.findUnique({
      where: { username },
    });

    if (!employee) {
      console.log(`❌ User '${username}' not found!`);
      console.log("\nAvailable users:");
      const users = await prisma.employee.findMany({
        select: { username: true, name: true },
      });
      users.forEach((u) => {
        console.log(`   - ${u.username} (${u.name})`);
      });
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log("📋 Current user info:");
    console.log(`   ID: ${employee.id}`);
    console.log(`   Name: ${employee.name}`);
    console.log(`   Username: ${employee.username}`);
    console.log(`   Current Role: ${employee.role}`);
    console.log(`   Active: ${employee.isActive}`);

    if (employee.role === "ADMIN") {
      console.log("\n✅ User is already an ADMIN!");
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log(`\n🔄 Updating role from ${employee.role} to ADMIN...`);

    const updated = await prisma.employee.update({
      where: { username },
      data: { role: "ADMIN" },
    });

    console.log("\n✅ Successfully updated!");
    console.log(`   ${updated.username} is now an ADMIN`);
    console.log("\n💡 Next steps:");
    console.log("   1. Logout from the app");
    console.log("   2. Login again with this account");
    console.log("   3. You should now have access to loyalty statistics");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateToAdmin();
