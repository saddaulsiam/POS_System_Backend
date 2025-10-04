const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkEmployees() {
  console.log("👥 All Employees in Database:\n");

  try {
    const employees = await prisma.employee.findMany({
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
      },
      orderBy: { id: "asc" },
    });

    console.log("Total employees:", employees.length);
    console.log("\n" + "=".repeat(80));

    employees.forEach((emp) => {
      const statusIcon = emp.isActive ? "✅" : "❌";
      const roleIcon =
        emp.role === "ADMIN" ? "👑" : emp.role === "MANAGER" ? "📊" : emp.role === "CASHIER" ? "💰" : "❓";

      console.log(`${statusIcon} ${roleIcon} ID: ${emp.id} | ${emp.name} (@${emp.username})`);
      console.log(`   Role: ${emp.role} | Active: ${emp.isActive}`);
      console.log(`   Can access loyalty stats: ${["ADMIN", "MANAGER"].includes(emp.role) ? "YES ✅" : "NO ❌"}`);
      console.log("   " + "-".repeat(76));
    });

    console.log("\n📊 Role Summary:");
    const roleCounts = employees.reduce((acc, emp) => {
      acc[emp.role] = (acc[emp.role] || 0) + 1;
      return acc;
    }, {});

    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`   ${role}: ${count}`);
    });

    console.log("\n💡 Valid roles for loyalty statistics:");
    console.log("   - ADMIN");
    console.log("   - MANAGER");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkEmployees();
