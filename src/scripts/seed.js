import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../utils/helpers.js";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding...");

  // Create admin PIN
  const adminPin = await hashPassword("1234");

  // 1. Create a dummy employee to satisfy Store.ownerId
  const dummy = await prisma.employee.create({
    data: {
      name: "Dummy Owner",
      username: "dummy",
      pinCode: adminPin,
      role: "ADMIN",
      // storeId intentionally omitted for bootstrap
    },
  });

  // 2. Create the store with ownerId = dummy.id
  const store = await prisma.store.create({
    data: {
      name: "Fresh Mart Grocery",
      ownerId: dummy.id,
    },
  });

  // 3. Create the real admin employee with storeId
  const admin = await prisma.employee.create({
    data: {
      name: "Admin User",
      username: "admin",
      pinCode: adminPin,
      role: "ADMIN",
      storeId: store.id,
    },
  });

  // 4. Update store to set real admin as owner
  await prisma.store.update({
    where: { id: store.id },
    data: { ownerId: admin.id },
  });

  // 5. Update dummy employee to set correct storeId (optional, or delete dummy if not needed)
  await prisma.employee.update({
    where: { id: dummy.id },
    data: { storeId: store.id },
  });

  // 4. Create categories
  const categories = await Promise.all([
    prisma.category.create({ data: { name: "Dairy & Eggs", storeId: store.id } }),
    prisma.category.create({ data: { name: "Fruits & Vegetables", storeId: store.id } }),
    prisma.category.create({ data: { name: "Meat & Seafood", storeId: store.id } }),
    prisma.category.create({ data: { name: "Bakery", storeId: store.id } }),
    prisma.category.create({ data: { name: "Beverages", storeId: store.id } }),
    prisma.category.create({ data: { name: "Snacks & Candy", storeId: store.id } }),
    prisma.category.create({ data: { name: "Frozen Foods", storeId: store.id } }),
    prisma.category.create({ data: { name: "Pantry Staples", storeId: store.id } }),
    prisma.category.create({ data: { name: "Health & Beauty", storeId: store.id } }),
    prisma.category.create({ data: { name: "Household Items", storeId: store.id } }),
  ]);

  // 5. Create a supplier
  await prisma.supplier.create({
    data: {
      name: "Fresh Farm Produce",
      contactName: "John Smith",
      phone: "555-0101",
      email: "orders@freshfarm.com",
      address: "123 Farm Road, Agricultural District",
      storeId: store.id,
    },
  });

  // 6. Create a customer
  await prisma.customer.create({
    data: {
      name: "John Doe",
      phoneNumber: "555-1001",
      email: "john.doe@email.com",
      loyaltyPoints: 150,
      address: "123 Main St, Anytown",
      storeId: store.id,
    },
  });

  // 7. Create a product
  await prisma.product.create({
    data: {
      name: "Whole Milk (1 Gallon)",
      sku: "MILK001",
      barcode: "1234567890123",
      description: "Fresh whole milk",
      categoryId: categories[0].id,
      supplierId: 1, // Assumes the first supplier created has id 1
      purchasePrice: 2.5,
      sellingPrice: 3.99,
      stockQuantity: 50,
      lowStockThreshold: 10,
      taxRate: 0,
      storeId: store.id,
    },
  });

  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error("Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
