import prisma from "../prisma.js";
import { hashPassword } from "../utils/helpers.js";

/**
 * Realistic grocery store seeding script
 * - Creates store, admin, dummy owner
 * - Creates suppliers, categories
 * - Seeds ~60 products (some with variants)
 * - Uses upsert throughout to be idempotent
 */

async function upsertCategory(name, storeId) {
  return prisma.category.upsert({
    where: { name },
    update: {},
    create: { name, storeId },
  });
}

async function upsertSupplier(data, storeId) {
  return prisma.supplier.upsert({
    where: { email: data.email },
    update: {},
    create: { ...data, storeId },
  });
}

async function upsertProduct(product, storeId, supplierId, categoryId) {
  // Only include valid fields for Prisma
  const {
    name,
    sku,
    barcode,
    description,
    purchasePrice,
    sellingPrice,
    stockQuantity,
    lowStockThreshold,
    taxRate,
    isWeighted,
    isActive,
    isDeleted,
    image,
    unit,
    hasVariants,
    expiryDate,
    lastSoldDate,
  } = product;

  const data = {
    name,
    sku,
    barcode,
    description,
    purchasePrice,
    sellingPrice,
    stockQuantity,
    lowStockThreshold,
    taxRate,
    isWeighted,
    isActive,
    isDeleted,
    image,
    unit,
    hasVariants,
    expiryDate,
    lastSoldDate,
    supplierId,
    categoryId,
    storeId,
  };
  // Remove undefined keys
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  return prisma.product.upsert({
    where: { sku: product.sku },
    update: {},
    create: data,
  });
}

async function upsertVariant(productId, variant) {
  const data = { productId, ...variant, isActive: true };
  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);
  return prisma.productVariant.upsert({
    where: { sku: variant.sku },
    update: {},
    create: data,
  });
}

async function main() {
  console.log("🌱 Starting grocery store seeding...");

  // hashed admin PIN
  const adminPin = await hashPassword("1234");
  const managerPin = await hashPassword("5678");
  const cashierPin = await hashPassword("9999");

  // 1) Create dummy owner (bootstrap) and store
  console.log("Creating dummy owner employee...");
  const dummy = await prisma.employee.upsert({
    where: { username: "dummy" },
    update: {},
    create: {
      name: "Dummy Owner",
      username: "dummy",
      pinCode: adminPin,
      role: "OWNER",
    },
  });

  let store = await prisma.store.findFirst({ where: { name: "Fresh Mart Grocery" } });
  if (!store) {
    console.log("Creating store: Fresh Mart Grocery");
    store = await prisma.store.create({
      data: {
        name: "Fresh Mart Grocery",
        ownerId: dummy.id,
      },
    });
    const posSettings = await prisma.posSettings.findFirst({ where: { storeId: store.id } });
    if (posSettings) {
      await prisma.posSettings.update({
        where: { id: posSettings.id },
        data: { storeName: "Fresh Mart Grocery" },
      });
    }
  } else {
    console.log("Store already exists: Fresh Mart Grocery");
  }

  // 2) Create real admin and assign as owner
  console.log("Creating real admin user...");
  const admin = await prisma.employee.upsert({
    where: { username: "grocery_admin" },
    update: {},
    create: {
      name: "Admin User",
      username: "grocery_admin",
      pinCode: adminPin,
      role: "ADMIN",
      storeId: store.id,
    },
  });

  console.log("Creating real manager user...");
  await prisma.employee.upsert({
    where: { username: "manager" },
    update: {},
    create: {
      name: "Manager User",
      username: "manager",
      pinCode: managerPin,
      role: "MANAGER",
      storeId: store.id,
    },
  });

  console.log("Creating real cashier user...");
  await prisma.employee.upsert({
    where: { username: "cashier1" },
    update: {},
    create: {
      name: "Cashier User",
      username: "cashier1",
      pinCode: cashierPin,
      role: "CASHIER",
      storeId: store.id,
    },
  });

  await prisma.store.update({
    where: { id: store.id },
    data: { ownerId: admin.id },
  });
  await prisma.employee.update({
    where: { id: dummy.id },
    data: { storeId: store.id },
  });
  console.log("✔ Store and admin setup complete");

  // 3) Categories (real grocery categories)
  const categoryNames = [
    "Dairy & Eggs",
    "Fruits & Vegetables",
    "Meat & Seafood",
    "Bakery",
    "Beverages",
    "Snacks",
    "Frozen Foods",
    "Pantry Staples",
    "Oils & Condiments",
    "Rice & Grains",
    "Spices & Pulses",
    "Household",
    "Health & Beauty",
    "Baby & Kids",
    "Cleaning Supplies",
  ];

  const categories = {};
  for (const name of categoryNames) {
    categories[name] = await upsertCategory(name, store.id);
    console.log(`Category ready: ${name}`);
  }

  // 4) Suppliers
  const suppliersData = [
    {
      name: "Fresh Farm Produce",
      contactName: "John Farmer",
      phone: "555-0101",
      email: "orders@freshfarm.com",
      address: "123 Farm Road",
    },
    {
      name: "Coastal Seafood Ltd.",
      contactName: "Rina Das",
      phone: "555-0202",
      email: "seafood@coastalsea.com",
      address: "Pier 7, Harbor",
    },
    {
      name: "Baker's Union",
      contactName: "Sam Baker",
      phone: "555-0303",
      email: "bakes@bakersunion.com",
      address: "15 Baker Lane",
    },
    {
      name: "Global Drinks Co.",
      contactName: "Maya Singh",
      phone: "555-0404",
      email: "sales@globaldrinks.co",
      address: "12 Beverage Blvd",
    },
    {
      name: "Pantry Wholesale",
      contactName: "Arif Ahmed",
      phone: "555-0505",
      email: "supplies@pantrywholesale.com",
      address: "88 Supply St",
    },
    {
      name: "Household Goods Inc.",
      contactName: "Nila Roy",
      phone: "555-0606",
      email: "house@householdinc.com",
      address: "101 Home Ave",
    },
  ];

  const suppliers = {};
  for (const s of suppliersData) {
    suppliers[s.email] = await upsertSupplier(s, store.id);
    console.log(`Supplier ready: ${s.name}`);
  }

  // 5) Sample customers
  await prisma.customer.upsert({
    where: { phoneNumber: "555-1001" },
    update: {},
    create: {
      name: "John Doe",
      phoneNumber: "555-1001",
      email: "john.doe@example.com",
      loyaltyPoints: 120,
      address: "45 Market St",
      storeId: store.id,
    },
  });
  console.log("Sample customer ready: John Doe");

  console.log("Creating base products...");

  // 6) Products dataset (realistic grocery items)
  // We'll create ~60 products: some base products and some with variants
  const products = [
    // Dairy & Eggs
    {
      name: "Full Cream Milk 1L",
      sku: "MILK-1L-FC",
      barcode: "8900000000001",
      description: "Full cream fresh milk - 1 liter",
      category: "Dairy & Eggs",
      supplierEmail: "orders@freshfarm.com",
      purchasePrice: 1.0,
      sellingPrice: 1.5,
      stockQuantity: 200,
      lowStockThreshold: 20,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Yogurt Natural 500g",
      sku: "YOG-500G-NAT",
      barcode: "8900000000002",
      description: "Natural yogurt - 500 grams",
      category: "Dairy & Eggs",
      supplierEmail: "orders@freshfarm.com",
      purchasePrice: 1.2,
      sellingPrice: 2.0,
      stockQuantity: 150,
      lowStockThreshold: 15,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1563114773-84221bd62daa?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Eggs (12pcs) Grade A",
      sku: "EGG-12-GA",
      barcode: "8900000000003",
      description: "Farm fresh eggs, dozen",
      category: "Dairy & Eggs",
      supplierEmail: "orders@freshfarm.com",
      purchasePrice: 0.9,
      sellingPrice: 1.4,
      stockQuantity: 300,
      lowStockThreshold: 30,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1598155523122-38423bb4d6c1?auto=format&fit=crop&w=800&q=80",
    },

    // Fruits & Vegetables
    {
      name: "Bananas (per kg)",
      sku: "FR-BAN-KG",
      barcode: "8900000000010",
      description: "Fresh bananas - price per kg",
      category: "Fruits & Vegetables",
      supplierEmail: "orders@freshfarm.com",
      purchasePrice: 0.5,
      sellingPrice: 0.9,
      stockQuantity: 120,
      isWeighted: true,
      lowStockThreshold: 10,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Tomato (per kg)",
      sku: "FR-TOM-KG",
      barcode: "8900000000011",
      description: "Fresh ripe tomatoes - per kg",
      category: "Fruits & Vegetables",
      supplierEmail: "orders@freshfarm.com",
      purchasePrice: 0.4,
      sellingPrice: 0.8,
      stockQuantity: 180,
      isWeighted: true,
      lowStockThreshold: 15,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Potato (per kg)",
      sku: "FR-POT-KG",
      barcode: "8900000000012",
      description: "White potato - per kg",
      category: "Fruits & Vegetables",
      supplierEmail: "orders@freshfarm.com",
      purchasePrice: 0.3,
      sellingPrice: 0.6,
      stockQuantity: 200,
      isWeighted: true,
      lowStockThreshold: 20,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1518977676605-dc56455512a5?auto=format&fit=crop&w=800&q=80",
    },

    // Meat & Seafood
    {
      name: "Chicken Whole (per kg)",
      sku: "MEAT-CHW-KG",
      barcode: "8900000000020",
      description: "Whole chicken - per kg",
      category: "Meat & Seafood",
      supplierEmail: "orders@freshfarm.com",
      purchasePrice: 2.0,
      sellingPrice: 3.2,
      stockQuantity: 80,
      isWeighted: true,
      lowStockThreshold: 10,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1587593810167-a84920ea0781?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Tilapia Fillet (per kg)",
      sku: "FISH-TIL-KG",
      barcode: "8900000000021",
      description: "Tilapia fillet fresh - per kg",
      category: "Meat & Seafood",
      supplierEmail: "seafood@coastalsea.com",
      purchasePrice: 3.5,
      sellingPrice: 5.0,
      stockQuantity: 40,
      isWeighted: true,
      lowStockThreshold: 8,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1519708227418-e8d316e88549?auto=format&fit=crop&w=800&q=80",
    },

    // Bakery
    {
      name: "Sliced White Bread (400g)",
      sku: "BREAD-S-W-400",
      barcode: "8900000000030",
      description: "Sliced white bread - 400g",
      category: "Bakery",
      supplierEmail: "bakes@bakersunion.com",
      purchasePrice: 0.5,
      sellingPrice: 0.9,
      stockQuantity: 120,
      lowStockThreshold: 15,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Croissant (single)",
      sku: "BREAD-CRO-1",
      barcode: "8900000000031",
      description: "Buttery croissant - single piece",
      category: "Bakery",
      supplierEmail: "bakes@bakersunion.com",
      purchasePrice: 0.3,
      sellingPrice: 0.8,
      stockQuantity: 200,
      lowStockThreshold: 20,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80",
    },

    // Beverages (some will have variants)
    {
      name: "Sparkling Water 500ml",
      sku: "WATER-SP-500",
      barcode: "8900000000040",
      description: "Sparkling mineral water - 500ml",
      category: "Beverages",
      supplierEmail: "sales@globaldrinks.co",
      purchasePrice: 0.25,
      sellingPrice: 0.6,
      stockQuantity: 300,
      lowStockThreshold: 30,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1560023907-5f339617ea30?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Orange Juice 1L",
      sku: "OJ-1L",
      barcode: "8900000000041",
      description: "100% orange juice - 1 liter",
      category: "Beverages",
      supplierEmail: "sales@globaldrinks.co",
      purchasePrice: 1.0,
      sellingPrice: 1.8,
      stockQuantity: 150,
      lowStockThreshold: 15,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?auto=format&fit=crop&w=800&q=80",
    },

    // Snacks (base)
    {
      name: "Salted Potato Chips 75g",
      sku: "SN-CHP-75G",
      barcode: "8900000000050",
      description: "Salted potato chips - 75g",
      category: "Snacks",
      supplierEmail: "pantrywholesale.com" === "" ? "orders@freshfarm.com" : "supplies@pantrywholesale.com",
      purchasePrice: 0.2,
      sellingPrice: 0.5,
      stockQuantity: 400,
      lowStockThreshold: 50,
      taxRate: 5,
      image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=800&q=80",
    },

    // Frozen Foods
    {
      name: "Frozen Mixed Vegetables 1kg",
      sku: "FZ-VEG-1KG",
      barcode: "8900000000060",
      description: "Frozen mixed vegetables - 1kg",
      category: "Frozen Foods",
      supplierEmail: "pantrywholesale.com" === "" ? "orders@freshfarm.com" : "supplies@pantrywholesale.com",
      purchasePrice: 1.5,
      sellingPrice: 2.5,
      stockQuantity: 80,
      lowStockThreshold: 10,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1571166166174-8db9931eb6f6?auto=format&fit=crop&w=800&q=80",
    },

    // Pantry Staples
    {
      name: "All Purpose Flour 1kg",
      sku: "PAN-FLR-1KG",
      barcode: "8900000000070",
      description: "All purpose wheat flour - 1kg",
      category: "Pantry Staples",
      supplierEmail: "supplies@pantrywholesale.com",
      purchasePrice: 0.6,
      sellingPrice: 1.2,
      stockQuantity: 160,
      lowStockThreshold: 20,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Granulated Sugar 1kg",
      sku: "PAN-SUG-1KG",
      barcode: "8900000000071",
      description: "Refined granulated sugar - 1kg",
      category: "Pantry Staples",
      supplierEmail: "supplies@pantrywholesale.com",
      purchasePrice: 0.5,
      sellingPrice: 1.0,
      stockQuantity: 180,
      lowStockThreshold: 20,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1610450949065-2244a8809df6?auto=format&fit=crop&w=800&q=80",
    },

    // Oils & Condiments
    {
      name: "Sunflower Oil 1L",
      sku: "OIL-SF-1L",
      barcode: "8900000000080",
      description: "Refined sunflower oil - 1 liter",
      category: "Oils & Condiments",
      supplierEmail: "supplies@pantrywholesale.com",
      purchasePrice: 1.8,
      sellingPrice: 3.2,
      stockQuantity: 120,
      lowStockThreshold: 15,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1474979266404-7eaacbcdccef?auto=format&fit=crop&w=800&q=80",
    },

    // Rice & Grains
    {
      name: "Basmati Rice 5kg",
      sku: "RICE-BAS-5KG",
      barcode: "8900000000090",
      description: "Premium basmati rice - 5kg bag",
      category: "Rice & Grains",
      supplierEmail: "supplies@pantrywholesale.com",
      purchasePrice: 6.0,
      sellingPrice: 9.5,
      stockQuantity: 60,
      lowStockThreshold: 10,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
    },

    // Spices & Pulses
    {
      name: "Red Lentils (Masoor) 1kg",
      sku: "PUL-MAS-1KG",
      barcode: "8900000000100",
      description: "Red lentils - 1kg pack",
      category: "Spices & Pulses",
      supplierEmail: "supplies@pantrywholesale.com",
      purchasePrice: 1.2,
      sellingPrice: 2.2,
      stockQuantity: 140,
      lowStockThreshold: 15,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1515543904379-3d757afe72e3?auto=format&fit=crop&w=800&q=80",
    },

    // Household
    {
      name: "Toilet Paper 4-rolls",
      sku: "HH-TP-4",
      barcode: "8900000000110",
      description: "Soft toilet paper - 4 rolls",
      category: "Household",
      supplierEmail: "house@householdinc.com",
      purchasePrice: 0.75,
      sellingPrice: 1.5,
      stockQuantity: 160,
      lowStockThreshold: 20,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1584620583866-e82200dc896c?auto=format&fit=crop&w=800&q=80",
    },

    // Health & Beauty
    {
      name: "Hand Soap 250ml",
      sku: "HB-HS-250",
      barcode: "8900000000120",
      description: "Liquid hand soap - 250ml",
      category: "Health & Beauty",
      supplierEmail: "house@householdinc.com",
      purchasePrice: 0.4,
      sellingPrice: 0.95,
      stockQuantity: 200,
      lowStockThreshold: 30,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1596207891316-230543889770?auto=format&fit=crop&w=800&q=80",
    },

    // Baby & Kids
    {
      name: "Baby Diapers Size M (20pcs)",
      sku: "BAB-DI-M-20",
      barcode: "8900000000130",
      description: "Disposable baby diapers - size M - 20pcs",
      category: "Baby & Kids",
      supplierEmail: "house@householdinc.com",
      purchasePrice: 4.0,
      sellingPrice: 6.5,
      stockQuantity: 90,
      lowStockThreshold: 10,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1519689680058-324335c77eba?auto=format&fit=crop&w=800&q=80",
    },

    // Cleaning Supplies
    {
      name: "Dishwashing Liquid 500ml",
      sku: "CL-DW-500",
      barcode: "8900000000140",
      description: "Concentrated dishwashing liquid - 500ml",
      category: "Cleaning Supplies",
      supplierEmail: "house@householdinc.com",
      purchasePrice: 0.45,
      sellingPrice: 0.95,
      stockQuantity: 210,
      lowStockThreshold: 30,
      taxRate: 0,
      image: "https://images.unsplash.com/photo-1585833830495-2c219602e1a3?auto=format&fit=crop&w=800&q=80",
    },
  ];

  // 7) Add product variants datasets (examples: soft drinks, cooking oil pack sizes, rice pack sizes, chips flavors)
  const productsWithVariants = [
    {
      product: {
        name: "Mojo Cola",
        sku: "MOJO-COLA",
        barcode: "8900000000200",
        description: "Mojo cola soft drink - multiple sizes",
        category: "Beverages",
        supplierEmail: "sales@globaldrinks.co",
        purchasePrice: 0, // we'll rely on variant-level pricing
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        lowStockThreshold: 30,
        taxRate: 5,
        image: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80",
      },
      variants: [
        {
          name: "Mojo 250ml Can",
          sku: "MOJO-250ML",
          barcode: "8900000000201",
          purchasePrice: 0.2,
          sellingPrice: 0.45,
          stockQuantity: 200,
        },
        {
          name: "Mojo 330ml Can",
          sku: "MOJO-330ML",
          barcode: "8900000000202",
          purchasePrice: 0.25,
          sellingPrice: 0.6,
          stockQuantity: 180,
        },
        {
          name: "Mojo 500ml Bottle",
          sku: "MOJO-500ML",
          barcode: "8900000000203",
          purchasePrice: 0.35,
          sellingPrice: 0.8,
          stockQuantity: 150,
        },
        {
          name: "Mojo 1.5L Bottle",
          sku: "MOJO-1.5L",
          barcode: "8900000000204",
          purchasePrice: 0.8,
          sellingPrice: 1.8,
          stockQuantity: 120,
        },
      ],
    },
    {
      product: {
        name: "Crispy Chips",
        sku: "CRSP-CHIPS",
        barcode: "8900000000210",
        description: "Crispy potato chips - multiple flavors & sizes",
        category: "Snacks",
        supplierEmail: "supplies@pantrywholesale.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        lowStockThreshold: 40,
        taxRate: 5,
        image: "https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=800&q=80",
      },
      variants: [
        {
          name: "Chips 50g - Original",
          sku: "CHIPS-50G-ORIG",
          barcode: "8900000000211",
          purchasePrice: 0.15,
          sellingPrice: 0.35,
          stockQuantity: 400,
        },
        {
          name: "Chips 50g - Spicy",
          sku: "CHIPS-50G-SPICY",
          barcode: "8900000000212",
          purchasePrice: 0.15,
          sellingPrice: 0.35,
          stockQuantity: 380,
        },
        {
          name: "Chips 150g - Family",
          sku: "CHIPS-150G-FAM",
          barcode: "8900000000213",
          purchasePrice: 0.4,
          sellingPrice: 0.95,
          stockQuantity: 180,
        },
      ],
    },
    {
      product: {
        name: "Sunflower Oil",
        sku: "OIL-SUN",
        barcode: "8900000000220",
        description: "Refined sunflower oil - multiple pack sizes",
        category: "Oils & Condiments",
        supplierEmail: "supplies@pantrywholesale.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        lowStockThreshold: 20,
        taxRate: 0,
        image: "https://images.unsplash.com/photo-1474979266404-7eaacbcdccef?auto=format&fit=crop&w=800&q=80",
      },
      variants: [
        {
          name: "Sunflower 500ml",
          sku: "OIL-SUN-500",
          barcode: "8900000000221",
          purchasePrice: 0.95,
          sellingPrice: 1.8,
          stockQuantity: 120,
        },
        {
          name: "Sunflower 1L",
          sku: "OIL-SUN-1L",
          barcode: "8900000000222",
          purchasePrice: 1.8,
          sellingPrice: 3.2,
          stockQuantity: 160,
        },
        {
          name: "Sunflower 5L",
          sku: "OIL-SUN-5L",
          barcode: "8900000000223",
          purchasePrice: 8.0,
          sellingPrice: 12.5,
          stockQuantity: 20,
        },
      ],
    },
    {
      product: {
        name: "Basmati Rice",
        sku: "RICE-BAS",
        barcode: "8900000000230",
        description: "Premium basmati rice - multiple pack sizes",
        category: "Rice & Grains",
        supplierEmail: "supplies@pantrywholesale.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        lowStockThreshold: 12,
        taxRate: 0,
        image: "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80",
      },
      variants: [
        {
          name: "Basmati 1kg",
          sku: "RICE-BAS-1KG",
          barcode: "8900000000231",
          purchasePrice: 1.4,
          sellingPrice: 2.5,
          stockQuantity: 140,
        },
        {
          name: "Basmati 5kg",
          sku: "RICE-BAS-5KG-V",
          barcode: "8900000000232",
          purchasePrice: 6.0,
          sellingPrice: 9.5,
          stockQuantity: 70,
        },
        {
          name: "Basmati 10kg",
          sku: "RICE-BAS-10KG",
          barcode: "8900000000233",
          purchasePrice: 11.0,
          sellingPrice: 17.5,
          stockQuantity: 30,
        },
      ],
    },
    {
      product: {
        name: "Ice Cream Tub",
        sku: "ICE-CRM",
        barcode: "8900000000240",
        description: "Premium ice cream - multiple flavors & tub sizes",
        category: "Frozen Foods",
        supplierEmail: "supplies@pantrywholesale.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        lowStockThreshold: 20,
        taxRate: 5,
        image: "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?auto=format&fit=crop&w=800&q=80",
      },
      variants: [
        {
          name: "Ice Cream 500ml - Vanilla",
          sku: "ICE-500-VAN",
          barcode: "8900000000241",
          purchasePrice: 1.2,
          sellingPrice: 2.4,
          stockQuantity: 80,
        },
        {
          name: "Ice Cream 500ml - Chocolate",
          sku: "ICE-500-CHO",
          barcode: "8900000000242",
          purchasePrice: 1.2,
          sellingPrice: 2.4,
          stockQuantity: 70,
        },
      ],
    },
  ];

  // 8) Seed base products
  for (const p of products) {
    const supplier = suppliers[p.supplierEmail] || Object.values(suppliers)[0];
    const category = categories[p.category];
    if (!category) {
      console.warn("Missing category for product:", p.name, p.category);
      continue;
    }
    await upsertProduct(p, store.id, supplier.id, category.id);
    console.log(`Product ready: ${p.name}`);
  }

  // 9) Seed products with variants
  for (const group of productsWithVariants) {
    const p = group.product;
    const supplier = suppliers[p.supplierEmail] || Object.values(suppliers)[0];
    const category = categories[p.category];
    const created = await upsertProduct(p, store.id, supplier.id, category.id);
    console.log(`Product with variants ready: ${p.name}`);
    for (const v of group.variants) {
      await upsertVariant(created.id, v);
      console.log(`  Variant ready: ${v.name}`);
    }
  }

  // 10) Additional realistic single items (fill out to ~60)
  const moreProducts = [
    {
      name: "Black Tea 250g",
      sku: "TEA-250G",
      barcode: "8900000000301",
      description: "Loose black tea - 250g",
      category: "Pantry Staples",
      supplierEmail: "supplies@pantrywholesale.com",
      purchasePrice: 1.5,
      sellingPrice: 2.8,
      stockQuantity: 120,
      lowStockThreshold: 12,
      image: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Instant Coffee 100g",
      sku: "COF-100G",
      barcode: "8900000000302",
      description: "Instant coffee - 100g jar",
      category: "Pantry Staples",
      supplierEmail: "supplies@pantrywholesale.com",
      purchasePrice: 1.6,
      sellingPrice: 3.0,
      stockQuantity: 90,
      lowStockThreshold: 10,
      image: "https://images.unsplash.com/photo-1570968915860-54d5c301fa9f?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Peanut Butter 350g",
      sku: "PB-350G",
      barcode: "8900000000303",
      description: "Creamy peanut butter - 350g",
      category: "Pantry Staples",
      supplierEmail: "supplies@pantrywholesale.com",
      purchasePrice: 1.8,
      sellingPrice: 3.5,
      stockQuantity: 100,
      lowStockThreshold: 10,
      image: "https://images.unsplash.com/photo-1518133100375-99d750058b8f?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Canned Tuna 185g",
      sku: "TUNA-185G",
      barcode: "8900000000304",
      description: "Canned tuna in oil - 185g",
      category: "Pantry Staples",
      supplierEmail: "supplies@pantrywholesale.com",
      purchasePrice: 0.95,
      sellingPrice: 1.8,
      stockQuantity: 140,
      lowStockThreshold: 15,
      image: "https://images.unsplash.com/photo-1626082927389-d31c0d58849b?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Mayonnaise 250g",
      sku: "MAY-250G",
      barcode: "8900000000305",
      description: "Creamy mayonnaise - 250g",
      category: "Oils & Condiments",
      supplierEmail: "supplies@pantrywholesale.com",
      purchasePrice: 0.8,
      sellingPrice: 1.6,
      stockQuantity: 120,
      lowStockThreshold: 12,
      image: "https://images.unsplash.com/photo-1620216794692-a169b12275b0?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Mozzarella Cheese 200g",
      sku: "CHE-MOZ-200",
      barcode: "8900000000306",
      description: "Mozzarella cheese - 200g",
      category: "Dairy & Eggs",
      supplierEmail: "orders@freshfarm.com",
      purchasePrice: 1.8,
      sellingPrice: 3.5,
      stockQuantity: 60,
      lowStockThreshold: 8,
      image: "https://images.unsplash.com/photo-1588195536545-0d268294bd8a?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Beef Mince (per kg)",
      sku: "BEEF-MIN-KG",
      barcode: "8900000000307",
      description: "Fresh beef mince - per kg",
      category: "Meat & Seafood",
      supplierEmail: "orders@freshfarm.com",
      purchasePrice: 4.0,
      sellingPrice: 6.5,
      stockQuantity: 30,
      isWeighted: true,
      lowStockThreshold: 5,
      image: "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Garlic (per 100g)",
      sku: "SP-GAR-100G",
      barcode: "8900000000308",
      description: "Fresh garlic - 100g",
      category: "Spices & Pulses",
      supplierEmail: "orders@freshfarm.com",
      purchasePrice: 0.3,
      sellingPrice: 0.7,
      stockQuantity: 200,
      isWeighted: true,
      lowStockThreshold: 20,
      image: "https://images.unsplash.com/photo-1540148426945-6cf99a61c488?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Toothpaste 120g",
      sku: "HB-TP-120",
      barcode: "8900000000309",
      description: "Fluoride toothpaste - 120g",
      category: "Health & Beauty",
      supplierEmail: "house@householdinc.com",
      purchasePrice: 0.5,
      sellingPrice: 1.2,
      stockQuantity: 200,
      lowStockThreshold: 20,
      image: "https://images.unsplash.com/photo-1559599189-fe84dea4eb79?auto=format&fit=crop&w=800&q=80",
    },
    {
      name: "Shampoo 400ml",
      sku: "HB-SH-400",
      barcode: "8900000000310",
      description: "Hair shampoo - 400ml",
      category: "Health & Beauty",
      supplierEmail: "house@householdinc.com",
      purchasePrice: 1.2,
      sellingPrice: 2.5,
      stockQuantity: 140,
      lowStockThreshold: 15,
      image: "https://images.unsplash.com/photo-1519735777090-ec97162dc01c?auto=format&fit=crop&w=800&q=80",
    },
  ];

  for (const mp of moreProducts) {
    const supplier = suppliers[mp.supplierEmail] || Object.values(suppliers)[0];
    const category = categories[mp.category];
    if (!category) {
      console.warn("Missing category for more product:", mp.name, mp.category);
      continue;
    }
    await upsertProduct(mp, store.id, supplier.id, category.id);
    console.log(`Product ready: ${mp.name}`);
  }

  console.log("🎉 Seeding complete — grocery catalog created!");
}

main()
  .catch((err) => {
    console.error("❌ Seeding error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
