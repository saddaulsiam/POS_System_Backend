import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "url";
import { hashPassword } from "../utils/helpers.js";

const prisma = new PrismaClient();

export async function createDefaultEmployees() {
  try {
    console.log("🔄 Checking/creating default employees...");

    const existing = await prisma.employee.count();
    if (existing > 0) {
      console.log(`ℹ️  ${existing} employee(s) already exist — skipping default employee creation.`);
      return;
    }

    // Create employees
    console.log("Creating employees...");
    const adminPin = await hashPassword("1234");
    const managerPin = await hashPassword("5678");
    const cashierPin = await hashPassword("9999");

    const employees = await Promise.all([
      prisma.employee.create({
        data: {
          name: "Admin User",
          username: "admin",
          pinCode: adminPin,
          role: "ADMIN",
          isActive: true,
        },
      }),
      prisma.employee.create({
        data: {
          name: "Store Manager",
          username: "manager",
          pinCode: managerPin,
          role: "MANAGER",
          isActive: true,
        },
      }),
      prisma.employee.create({
        data: {
          name: "Cashier One",
          username: "cashier1",
          pinCode: cashierPin,
          role: "CASHIER",
          isActive: true,
        },
      }),
      prisma.employee.create({
        data: {
          name: "Cashier Two",
          username: "cashier2",
          pinCode: cashierPin,
          role: "CASHIER",
          isActive: true,
        },
      }),
    ]);

    console.log("\n✅ Default employees created successfully!");
    console.log("=".repeat(50));
    console.log("📋 Login Credentials:");
    console.log("   Username: admin    PIN: 1234");
    console.log("   Username: manager  PIN: 5678");
    console.log("   Username: cashier1 PIN: 9999");
    console.log("   Username: cashier2 PIN: 9999");
    console.log("=".repeat(50));
  } catch (error) {
    if (error.code === "P2002") {
      console.log("\nℹ️  Some default users already exist (unique constraint). Skipping duplicates.");
    } else {
      console.error("\n❌ Error creating default employees:", error);
      throw error;
    }
  }
}

// Convenience wrapper used by app startup
export async function initOnStartup() {
  try {
    await createDefaultEmployees();
  } catch (err) {
    console.error("Error during startup initialization:", err);
  }
}

// If run directly, execute and exit
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  createDefaultEmployees()
    .then(() => {
      console.log("\n✨ Done!");
      prisma.$disconnect().then(() => process.exit(0));
    })
    .catch((error) => {
      console.error("\n💥 Fatal error:", error);
      prisma.$disconnect().then(() => process.exit(1));
    });
}
