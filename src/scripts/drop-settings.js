import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Dropping SystemSettings table to resolve schema conflicts...");
  // Drop the table using raw SQL
  await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "SystemSettings" CASCADE;`);
  console.log("Table dropped successfully.");
}

main()
  .catch((e) => {
    console.error("Failed to drop table:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
