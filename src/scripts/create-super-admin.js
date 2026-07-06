import { hashPassword } from "../utils/helpers.js";
import prisma from "../prisma.js";

async function main() {
  const args = process.argv.slice(2);
  const username = args[0] || "superadmin";
  const pin = args[1] || "9999";
  const name = args[2] || "Super Admin";
  const email = args[3] || "superadmin@possystem.com";

  console.log("⚙️ Creating Super Admin account...");
  console.log(`Username: ${username}`);
  console.log(`Name:     ${name}`);
  console.log(`Email:    ${email}`);
  console.log(`PIN:      ${pin}`);

  try {
    // Check if username already exists
    const existing = await prisma.employee.findUnique({
      where: { username },
    });

    if (existing) {
      console.error(`❌ Error: Username '${username}' is already taken.`);
      process.exit(1);
    }

    const hashedPin = await hashPassword(pin);

    const superAdmin = await prisma.employee.create({
      data: {
        name,
        username,
        email,
        pinCode: hashedPin,
        role: "SUPER_ADMIN",
        storeId: null, // Super Admin is global
        isActive: true,
      },
    });

    console.log(`\n✅ Super Admin created successfully!`);
    console.log(`ID: ${superAdmin.id}`);
  } catch (error) {
    console.error("❌ Failed to create Super Admin:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
