import prisma from "../prisma.js";

async function cleanup() {
  try {
    console.log("Checking database...");

    const employees = await prisma.employee.findMany();
    console.log(`Found ${employees.length} employees`);
    employees.forEach((e) => {
      console.log(`- ${e.username} (ID: ${e.id}, Role: ${e.role})`);
    });

    const stores = await prisma.store.findMany();
    console.log(`\nFound ${stores.length} stores`);
    stores.forEach((s) => {
      console.log(`- ${s.name} (ID: ${s.id})`);
    });

    const posSettings = await prisma.pOSSettings.findMany();
    console.log(`\nFound ${posSettings.length} POS settings`);
    posSettings.forEach((p) => {
      console.log(`- Store: ${p.storeName}, Email: ${p.storeEmail || "N/A"}`);
    });

    console.log("\nDeleting all data in correct order...");
    // Delete in order to respect foreign key constraints
    await prisma.pOSSettings.deleteMany({});
    console.log("✓ POS settings deleted");

    await prisma.store.deleteMany({});
    console.log("✓ Stores deleted");

    await prisma.employee.deleteMany({});
    console.log("✓ Employees deleted");

    console.log("\n✅ Database cleaned successfully!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
