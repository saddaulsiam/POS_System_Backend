/**
 * List all users in the database
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function listUsers() {
  try {
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
      },
    });

    console.log("\n📋 Users in Database:");
    console.log("=".repeat(70));

    if (employees.length === 0) {
      console.log("❌ No users found! Database is empty.");
      console.log("\n💡 Run: node src/scripts/create-admin.js");
    } else {
      employees.forEach((emp, index) => {
        console.log(`\n${index + 1}. ${emp.name}`);
        console.log(`   ID: ${emp.id}`);
        console.log(`   Username: ${emp.username}`);
        console.log(`   Role: ${emp.role}`);
        console.log(`   Active: ${emp.isActive ? "✅ Yes" : "❌ No"}`);
      });
    }

    console.log("\n" + "=".repeat(70));
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
