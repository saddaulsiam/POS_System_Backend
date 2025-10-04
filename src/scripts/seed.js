const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../utils/helpers");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seeding...");

  try {
    // Create categories
    console.log("Creating categories...");
    const categories = await Promise.all([
      prisma.category.create({ data: { name: "Dairy & Eggs" } }),
      prisma.category.create({ data: { name: "Fruits & Vegetables" } }),
      prisma.category.create({ data: { name: "Meat & Seafood" } }),
      prisma.category.create({ data: { name: "Bakery" } }),
      prisma.category.create({ data: { name: "Beverages" } }),
      prisma.category.create({ data: { name: "Snacks & Candy" } }),
      prisma.category.create({ data: { name: "Frozen Foods" } }),
      prisma.category.create({ data: { name: "Pantry Staples" } }),
      prisma.category.create({ data: { name: "Health & Beauty" } }),
      prisma.category.create({ data: { name: "Household Items" } }),
    ]);

    // Create suppliers
    console.log("Creating suppliers...");
    const suppliers = await Promise.all([
      prisma.supplier.create({
        data: {
          name: "Fresh Farm Produce",
          contactName: "John Smith",
          phone: "555-0101",
          email: "orders@freshfarm.com",
          address: "123 Farm Road, Agricultural District",
        },
      }),
      prisma.supplier.create({
        data: {
          name: "Metro Dairy Co.",
          contactName: "Sarah Johnson",
          phone: "555-0102",
          email: "sales@metrodairy.com",
          address: "456 Dairy Lane, Industrial Zone",
        },
      }),
      prisma.supplier.create({
        data: {
          name: "Global Foods Distributor",
          contactName: "Mike Chen",
          phone: "555-0103",
          email: "procurement@globalfoods.com",
          address: "789 Distribution Center, Commerce Park",
        },
      }),
    ]);

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
        },
      }),
      prisma.employee.create({
        data: {
          name: "Store Manager",
          username: "manager",
          pinCode: managerPin,
          role: "MANAGER",
        },
      }),
      prisma.employee.create({
        data: {
          name: "Cashier One",
          username: "cashier1",
          pinCode: cashierPin,
          role: "CASHIER",
        },
      }),
      prisma.employee.create({
        data: {
          name: "Cashier Two",
          username: "cashier2",
          pinCode: cashierPin,
          role: "CASHIER",
        },
      }),
    ]);

    // Create customers
    console.log("Creating customers...");
    const customers = await Promise.all([
      prisma.customer.create({
        data: {
          name: "John Doe",
          phoneNumber: "555-1001",
          email: "john.doe@email.com",
          loyaltyPoints: 150,
          address: "123 Main St, Anytown",
        },
      }),
      prisma.customer.create({
        data: {
          name: "Jane Smith",
          phoneNumber: "555-1002",
          email: "jane.smith@email.com",
          loyaltyPoints: 250,
          address: "456 Oak Ave, Somewhere",
        },
      }),
      prisma.customer.create({
        data: {
          name: "Bob Johnson",
          phoneNumber: "555-1003",
          email: "bob.johnson@email.com",
          loyaltyPoints: 75,
          address: "789 Pine St, Elsewhere",
        },
      }),
    ]);

    // Create products
    console.log("Creating products...");
    const products = [
      // Dairy & Eggs
      {
        name: "Whole Milk (1 Gallon)",
        sku: "MILK001",
        barcode: "1234567890123",
        description: "Fresh whole milk",
        categoryId: categories[0].id,
        supplierId: suppliers[1].id,
        purchasePrice: 2.5,
        sellingPrice: 3.99,
        stockQuantity: 50,
        lowStockThreshold: 10,
        taxRate: 0,
      },
      {
        name: "Large Eggs (Dozen)",
        sku: "EGG001",
        barcode: "1234567890124",
        description: "Grade A large eggs",
        categoryId: categories[0].id,
        supplierId: suppliers[1].id,
        purchasePrice: 1.8,
        sellingPrice: 2.99,
        stockQuantity: 75,
        lowStockThreshold: 15,
        taxRate: 0,
      },
      {
        name: "Cheddar Cheese (8oz)",
        sku: "CHEESE001",
        barcode: "1234567890125",
        description: "Sharp cheddar cheese block",
        categoryId: categories[0].id,
        supplierId: suppliers[1].id,
        purchasePrice: 3.2,
        sellingPrice: 4.99,
        stockQuantity: 30,
        lowStockThreshold: 8,
        taxRate: 0,
      },
      // Fruits & Vegetables
      {
        name: "Bananas",
        sku: "BANANA001",
        barcode: "1234567890126",
        description: "Fresh bananas",
        categoryId: categories[1].id,
        supplierId: suppliers[0].id,
        purchasePrice: 0.4,
        sellingPrice: 0.69,
        stockQuantity: 0, // Per pound - will be weighed
        lowStockThreshold: 0,
        isWeighted: true,
        taxRate: 0,
      },
      {
        name: "Red Apples",
        sku: "APPLE001",
        barcode: "1234567890127",
        description: "Fresh red apples",
        categoryId: categories[1].id,
        supplierId: suppliers[0].id,
        purchasePrice: 0.8,
        sellingPrice: 1.29,
        stockQuantity: 0,
        lowStockThreshold: 0,
        isWeighted: true,
        taxRate: 0,
      },
      {
        name: "Carrots (2lb bag)",
        sku: "CARROT001",
        barcode: "1234567890128",
        description: "Fresh carrots in 2lb bag",
        categoryId: categories[1].id,
        supplierId: suppliers[0].id,
        purchasePrice: 1.2,
        sellingPrice: 1.99,
        stockQuantity: 40,
        lowStockThreshold: 10,
        taxRate: 0,
      },
      // Beverages
      {
        name: "Coca-Cola (2L)",
        sku: "COKE001",
        barcode: "1234567890129",
        description: "Coca-Cola 2 liter bottle",
        categoryId: categories[4].id,
        supplierId: suppliers[2].id,
        purchasePrice: 1.25,
        sellingPrice: 2.49,
        stockQuantity: 60,
        lowStockThreshold: 12,
        taxRate: 8.25,
      },
      {
        name: "Orange Juice (64oz)",
        sku: "OJ001",
        barcode: "1234567890130",
        description: "Fresh orange juice",
        categoryId: categories[4].id,
        supplierId: suppliers[2].id,
        purchasePrice: 2.8,
        sellingPrice: 4.99,
        stockQuantity: 25,
        lowStockThreshold: 8,
        taxRate: 0,
      },
      // Bakery
      {
        name: "White Bread Loaf",
        sku: "BREAD001",
        barcode: "1234567890131",
        description: "Fresh white bread loaf",
        categoryId: categories[3].id,
        supplierId: suppliers[2].id,
        purchasePrice: 1.5,
        sellingPrice: 2.99,
        stockQuantity: 20,
        lowStockThreshold: 5,
        taxRate: 0,
      },
      {
        name: "Chocolate Chip Cookies",
        sku: "COOKIE001",
        barcode: "1234567890132",
        description: "Fresh baked chocolate chip cookies",
        categoryId: categories[3].id,
        supplierId: suppliers[2].id,
        purchasePrice: 2.5,
        sellingPrice: 4.99,
        stockQuantity: 15,
        lowStockThreshold: 5,
        taxRate: 8.25,
      },
      // Snacks
      {
        name: "Potato Chips (Family Size)",
        sku: "CHIPS001",
        barcode: "1234567890133",
        description: "Original flavor potato chips",
        categoryId: categories[5].id,
        supplierId: suppliers[2].id,
        purchasePrice: 2.0,
        sellingPrice: 3.99,
        stockQuantity: 45,
        lowStockThreshold: 10,
        taxRate: 8.25,
      },
      {
        name: "Chocolate Bar",
        sku: "CHOCO001",
        barcode: "1234567890134",
        description: "Milk chocolate candy bar",
        categoryId: categories[5].id,
        supplierId: suppliers[2].id,
        purchasePrice: 0.75,
        sellingPrice: 1.49,
        stockQuantity: 100,
        lowStockThreshold: 20,
        taxRate: 8.25,
      },
      // Pantry Staples
      {
        name: "Rice (5lb bag)",
        sku: "RICE001",
        barcode: "1234567890135",
        description: "Long grain white rice",
        categoryId: categories[7].id,
        supplierId: suppliers[2].id,
        purchasePrice: 3.5,
        sellingPrice: 5.99,
        stockQuantity: 25,
        lowStockThreshold: 8,
        taxRate: 0,
      },
      {
        name: "Pasta (1lb box)",
        sku: "PASTA001",
        barcode: "1234567890136",
        description: "Spaghetti pasta",
        categoryId: categories[7].id,
        supplierId: suppliers[2].id,
        purchasePrice: 0.8,
        sellingPrice: 1.49,
        stockQuantity: 60,
        lowStockThreshold: 15,
        taxRate: 0,
      },
      // Frozen Foods
      {
        name: "Frozen Pizza",
        sku: "PIZZA001",
        barcode: "1234567890137",
        description: "Pepperoni frozen pizza",
        categoryId: categories[6].id,
        supplierId: suppliers[2].id,
        purchasePrice: 3.5,
        sellingPrice: 5.99,
        stockQuantity: 20,
        lowStockThreshold: 5,
        taxRate: 8.25,
      },
    ];

    for (const productData of products) {
      await prisma.product.create({ data: productData });
    }

    // Create some sample sales
    console.log("Creating sample sales...");
    const sampleSale = await prisma.sale.create({
      data: {
        receiptId: "R001001",
        employeeId: employees[2].id, // Cashier
        customerId: customers[0].id,
        subtotal: 12.97,
        taxAmount: 0.32,
        discountAmount: 0,
        finalAmount: 13.29,
        paymentMethod: "CASH",
        cashReceived: 15.0,
        changeGiven: 1.71,
        saleItems: {
          create: [
            {
              productId: 1, // Milk
              quantity: 1,
              priceAtSale: 3.99,
              subtotal: 3.99,
            },
            {
              productId: 2, // Eggs
              quantity: 2,
              priceAtSale: 2.99,
              subtotal: 5.98,
            },
            {
              productId: 7, // Coke
              quantity: 1,
              priceAtSale: 2.49,
              subtotal: 2.49,
            },
            {
              productId: 12, // Chocolate
              quantity: 3,
              priceAtSale: 1.49,
              subtotal: 4.47,
            },
          ],
        },
      },
    });

    // Update stock quantities after sale
    await prisma.product.update({
      where: { id: 1 },
      data: { stockQuantity: { decrement: 1 } },
    });
    await prisma.product.update({
      where: { id: 2 },
      data: { stockQuantity: { decrement: 2 } },
    });
    await prisma.product.update({
      where: { id: 7 },
      data: { stockQuantity: { decrement: 1 } },
    });
    await prisma.product.update({
      where: { id: 12 },
      data: { stockQuantity: { decrement: 3 } },
    });

    // Create default POS Settings
    console.log("Creating POS settings...");
    await prisma.pOSSettings.create({
      data: {
        enableQuickSale: true,
        enableSplitPayment: true,
        enableParkSale: true,
        enableCustomerSearch: true,
        enableBarcodeScanner: true,
        enableLoyaltyPoints: true,
        storeName: "Fresh Mart Grocery",
        storeAddress: "123 Market Street, Shopping District, City, State 12345",
        storePhone: "(555) 123-4567",
        storeEmail: "info@freshmart.com",
        taxId: "TAX-123456789",
        taxRate: 8.25,
        currencySymbol: "$",
        currencyPosition: "before",
        receiptFooterText: "Thank you for shopping with us! Visit again soon.",
        returnPolicy: "Returns accepted within 30 days with receipt in original condition.",
        printReceiptAuto: false,
        emailReceiptAuto: false,
        enableLowStockAlerts: true,
        lowStockThreshold: 10,
        enableEmailNotifications: true,
        adminAlertEmail: "admin@freshmart.com",
        autoLogoutMinutes: 30,
        requirePasswordOnVoid: true,
        enableAuditLog: true,
        productsPerPage: 20,
        defaultView: "grid",
        showProductImages: true,
        updatedBy: 1, // Admin user
      },
    });

    console.log("Database seeding completed successfully!");
    console.log("\nDefault login credentials:");
    console.log("Admin - Username: admin, PIN: 1234");
    console.log("Manager - Username: manager, PIN: 5678");
    console.log("Cashier - Username: cashier1, PIN: 9999");
  } catch (error) {
    console.error("Error during seeding:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
