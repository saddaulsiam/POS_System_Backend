import prisma from "../prisma.js";
import { hashPassword } from "../utils/helpers.js";

/**
 * Realistic Shoe Store Seeding Script
 * Store: "Step Ahead Footwear"
 * Focus: Sizes as variants, Accessories as single items.
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
  // Remove undefined keys so Prisma uses defaults if applicable
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
  console.log("👟 Starting Shoe Store seeding...");

  const adminPin = await hashPassword("1234");

  // 1) Setup Store Owner/Employees
  console.log("Creating Shoe Store Staff...");

  const dummy = await prisma.employee.upsert({
    where: { username: "dummy_shoe" },
    update: {},
    create: { name: "Shoe Owner Dummy", username: "dummy_shoe", pinCode: adminPin, role: "OWNER" },
  });

  let store = await prisma.store.findFirst({ where: { name: "Step Ahead Footwear" } });
  if (!store) {
    store = await prisma.store.create({ data: { name: "Step Ahead Footwear", ownerId: dummy.id } });
    // after creating store, setup POS settings
    let posSettings = await prisma.pOSSettings.findFirst({ where: { storeId: store.id } });
    if (posSettings) {
      await prisma.pOSSettings.update({
        where: { id: posSettings.id },
        data: { storeName: "Step Ahead Footwear" },
      });
    } else {
      await prisma.pOSSettings.create({
        data: {
          storeName: "Step Ahead Footwear",
          storeId: store.id,
        },
      });
    }
    console.log("Store created: Step Ahead Footwear");
  } else {
    console.log("Store already exists: Step Ahead Footwear");
  }

  const admin = await prisma.employee.upsert({
    where: { username: "shoe_admin" },
    update: {},
    create: { name: "Shoe Admin", username: "shoe_admin", pinCode: adminPin, role: "ADMIN", storeId: store.id },
  });

  await prisma.store.update({ where: { id: store.id }, data: { ownerId: admin.id } });

  // Create subscription with 10-day trial
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 10);
  await prisma.subscription.upsert({
    where: { storeId: store.id },
    update: {},
    create: {
      storeId: store.id,
      status: "TRIAL",
      trialStartDate: new Date(),
      trialEndDate: trialEndDate,
    },
  });
  console.log("✔ Store and subscription created");

  // 2) Categories
  const categoryNames = [
    "Men's Running",
    "Women's Running",
    "Formal Wear",
    "Boots",
    "Sandals & Slides",
    "Kids",
    "Accessories",
    "Shoe Care",
  ];

  const categories = {};
  for (const name of categoryNames) {
    categories[name] = await upsertCategory(name, store.id);
  }

  // 3) Suppliers
  const suppliersData = [
    { name: "Speed Sports Inc.", email: "sales@speedsports.com", phone: "555-SHOES-1" },
    { name: "Leather Crafters Ltd.", email: "orders@leathercrafters.com", phone: "555-SHOES-2" },
    { name: "Comfy Soles Distrib", email: "supplies@comfysoles.com", phone: "555-SHOES-3" },
    { name: "Urban Kicks Wholesale", email: "wholesale@urbankicks.com", phone: "555-SHOES-4" },
  ];

  const suppliers = {};
  for (const s of suppliersData) {
    suppliers[s.email] = await upsertSupplier(s, store.id);
  }

  // 4) Base Products (Accessories & Single Items)
  const baseProducts = [
    {
      name: "Premium Shoe Polish - Black",
      sku: "ACC-POL-BLK",
      barcode: "9900000000001",
      description: "High gloss wax polish 50g",
      category: "Shoe Care",
      supplierEmail: "orders@leathercrafters.com",
      purchasePrice: 2.5,
      sellingPrice: 5.99,
      stockQuantity: 50,
      taxRate: 10,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764152097/pos/products/scrtjzyn7ioaylzipmc9.png",
    },
    {
      name: "Premium Shoe Polish - Brown",
      sku: "ACC-POL-BRN",
      barcode: "9900000000002",
      description: "High gloss wax polish 50g",
      category: "Shoe Care",
      supplierEmail: "orders@leathercrafters.com",
      purchasePrice: 2.5,
      sellingPrice: 5.99,
      stockQuantity: 40,
      taxRate: 10,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764152101/pos/products/hp8bmj1hfdf1ls0h0ib1.png",
    },
    {
      name: "Gel Insoles (One Size)",
      sku: "ACC-INS-GEL",
      barcode: "9900000000003",
      description: "Comfort gel insoles, trimmable",
      category: "Accessories",
      supplierEmail: "supplies@comfysoles.com",
      purchasePrice: 4.0,
      sellingPrice: 12.5,
      stockQuantity: 100,
      taxRate: 10,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764151169/pos/products/ukqjlrbe4kzd308owtew.png",
    },
    {
      name: "Cotton Laces - White 120cm",
      sku: "ACC-LACE-WHT",
      barcode: "9900000000004",
      description: "Flat cotton laces",
      category: "Accessories",
      supplierEmail: "wholesale@urbankicks.com",
      purchasePrice: 0.5,
      sellingPrice: 2.0,
      stockQuantity: 200,
      taxRate: 10,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764152616/pos/products/yulnkq7hjyqifzig4rao.png",
    },
    {
      name: "Cotton Laces - Black 120cm",
      sku: "ACC-LACE-BLK",
      barcode: "9900000000005",
      description: "Flat cotton laces",
      category: "Accessories",
      supplierEmail: "wholesale@urbankicks.com",
      purchasePrice: 0.5,
      sellingPrice: 2.0,
      stockQuantity: 200,
      taxRate: 10,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764152513/pos/products/b0gklkwdnzqurhenfqmg.png",
    },
    {
      name: "Waterproof Spray 200ml",
      sku: "ACC-SPR-WTR",
      barcode: "9900000000006",
      description: "Protective spray for suede and leather",
      category: "Shoe Care",
      supplierEmail: "orders@leathercrafters.com",
      purchasePrice: 3.5,
      sellingPrice: 8.99,
      stockQuantity: 60,
      taxRate: 10,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764150470/pos/products/lixrvq8lctla2vp6ukeq.png",
    },
    {
      name: "Long Metal Shoe Horn",
      sku: "ACC-HORN-MTL",
      barcode: "9900000000007",
      description: "Durable metal shoe horn",
      category: "Accessories",
      supplierEmail: "supplies@comfysoles.com",
      purchasePrice: 1.5,
      sellingPrice: 4.5,
      stockQuantity: 40,
      taxRate: 10,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764152801/pos/products/dpa9iwzwx7wpdntfb6zj.png",
    },
    {
      name: "Suede Cleaning Brush",
      sku: "ACC-BRUSH-SUE",
      barcode: "9900000000008",
      description: "Soft bristle brush for suede",
      category: "Shoe Care",
      supplierEmail: "orders@leathercrafters.com",
      purchasePrice: 2.0,
      sellingPrice: 5.99,
      stockQuantity: 30,
      taxRate: 10,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764152408/pos/products/t7bzbeyoff4wdsughnml.png",
    },
  ];

  for (const p of baseProducts) {
    const supplier = suppliers[p.supplierEmail];
    const category = categories[p.category];
    await upsertProduct(p, store.id, supplier.id, category.id);
    console.log(`Accessory ready: ${p.name}`);
  }

  // 5) Products with Variants (Sizes)
  const footwearData = [
    // --- MEN'S ---
    {
      product: {
        name: "Velocity Runner V2",
        sku: "SH-RUN-V2",
        barcode: "9900000000100",
        description: "Men's lightweight running shoe",
        category: "Men's Running",
        supplierEmail: "sales@speedsports.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 10,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764152811/pos/products/glnuhrey9gsqukwsq05y.png",
      },
      variants: [
        {
          name: "Velocity Runner V2 - Size 8",
          sku: "SH-RUN-V2-08",
          barcode: "9900000000108",
          purchasePrice: 40,
          sellingPrice: 85,
          stockQuantity: 10,
        },
        {
          name: "Velocity Runner V2 - Size 9",
          sku: "SH-RUN-V2-09",
          barcode: "9900000000109",
          purchasePrice: 40,
          sellingPrice: 85,
          stockQuantity: 15,
        },
        {
          name: "Velocity Runner V2 - Size 10",
          sku: "SH-RUN-V2-10",
          barcode: "9900000000110",
          purchasePrice: 40,
          sellingPrice: 85,
          stockQuantity: 12,
        },
        {
          name: "Velocity Runner V2 - Size 11",
          sku: "SH-RUN-V2-11",
          barcode: "9900000000111",
          purchasePrice: 40,
          sellingPrice: 85,
          stockQuantity: 8,
        },
      ],
    },
    {
      product: {
        name: "Pro-Court Tennis Shoe",
        sku: "SH-CRT-PRO",
        barcode: "9900000000120",
        description: "Durable court shoes for tennis",
        category: "Men's Running", // Grouping under sports
        supplierEmail: "sales@speedsports.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 10,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764152871/pos/products/kxrwmlacgxgmwlqhomzy.png",
      },
      variants: [
        {
          name: "Pro-Court - Size 9",
          sku: "SH-CRT-PRO-09",
          barcode: "9900000000121",
          purchasePrice: 45,
          sellingPrice: 95,
          stockQuantity: 8,
        },
        {
          name: "Pro-Court - Size 10",
          sku: "SH-CRT-PRO-10",
          barcode: "9900000000122",
          purchasePrice: 45,
          sellingPrice: 95,
          stockQuantity: 8,
        },
      ],
    },
    {
      product: {
        name: "Classic Oxford Leather",
        sku: "BT-OX-LEA",
        barcode: "9900000000200",
        description: "Formal leather shoes",
        category: "Formal Wear",
        supplierEmail: "orders@leathercrafters.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 10,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764151992/pos/products/dvb6qsakbqqvh1rwu0lz.png",
      },
      variants: [
        {
          name: "Oxford Leather - Size 40",
          sku: "BT-OX-LEA-40",
          barcode: "9900000000240",
          purchasePrice: 60,
          sellingPrice: 120,
          stockQuantity: 5,
        },
        {
          name: "Oxford Leather - Size 42",
          sku: "BT-OX-LEA-42",
          barcode: "9900000000242",
          purchasePrice: 60,
          sellingPrice: 120,
          stockQuantity: 8,
        },
        {
          name: "Oxford Leather - Size 44",
          sku: "BT-OX-LEA-44",
          barcode: "9900000000244",
          purchasePrice: 60,
          sellingPrice: 120,
          stockQuantity: 6,
        },
      ],
    },
    {
      product: {
        name: "Summer Slide Sandals",
        sku: "SND-SLD-M",
        barcode: "9900000000250",
        description: "Casual rubber slides",
        category: "Sandals & Slides",
        supplierEmail: "wholesale@urbankicks.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 10,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764151365/pos/products/bvnu718au4ac61uscnm4.png",
      },
      variants: [
        {
          name: "Slide Sandals - M",
          sku: "SND-SLD-M-MED",
          barcode: "9900000000251",
          purchasePrice: 8,
          sellingPrice: 20,
          stockQuantity: 30,
        },
        {
          name: "Slide Sandals - L",
          sku: "SND-SLD-M-LRG",
          barcode: "9900000000252",
          purchasePrice: 8,
          sellingPrice: 20,
          stockQuantity: 30,
        },
      ],
    },

    // --- WOMEN'S ---
    {
      product: {
        name: "Cloud Walker",
        sku: "W-SH-WLK",
        barcode: "9900000000400",
        description: "Women's memory foam walking shoes",
        category: "Women's Running",
        supplierEmail: "supplies@comfysoles.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 10,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764151349/pos/products/lj8lj4emiyf2obn6lezc.png",
      },
      variants: [
        {
          name: "Cloud Walker - Size 6",
          sku: "W-SH-WLK-06",
          barcode: "9900000000406",
          purchasePrice: 30,
          sellingPrice: 65,
          stockQuantity: 12,
        },
        {
          name: "Cloud Walker - Size 7",
          sku: "W-SH-WLK-07",
          barcode: "9900000000407",
          purchasePrice: 30,
          sellingPrice: 65,
          stockQuantity: 18,
        },
        {
          name: "Cloud Walker - Size 8",
          sku: "W-SH-WLK-08",
          barcode: "9900000000408",
          purchasePrice: 30,
          sellingPrice: 65,
          stockQuantity: 15,
        },
      ],
    },
    {
      product: {
        name: "Leather Ankle Boot",
        sku: "W-BT-ANK",
        barcode: "9900000000450",
        description: "Stylish brown leather ankle boots",
        category: "Boots",
        supplierEmail: "orders@leathercrafters.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 10,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764153393/pos/products/u0cey2s3pkuocngvdtz3.png",
      },
      variants: [
        {
          name: "Ankle Boot - Size 6",
          sku: "W-BT-ANK-06",
          barcode: "9900000000451",
          purchasePrice: 50,
          sellingPrice: 110,
          stockQuantity: 6,
        },
        {
          name: "Ankle Boot - Size 7",
          sku: "W-BT-ANK-07",
          barcode: "9900000000452",
          purchasePrice: 50,
          sellingPrice: 110,
          stockQuantity: 8,
        },
        {
          name: "Ankle Boot - Size 8",
          sku: "W-BT-ANK-08",
          barcode: "9900000000453",
          purchasePrice: 50,
          sellingPrice: 110,
          stockQuantity: 6,
        },
      ],
    },
    {
      product: {
        name: "Classic Ballet Flat",
        sku: "W-FLAT-BLK",
        barcode: "9900000000480",
        description: "Black comfortable flats",
        category: "Formal Wear",
        supplierEmail: "supplies@comfysoles.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 10,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764151583/pos/products/jd0n3zo5hfkncklnyf8h.png",
      },
      variants: [
        {
          name: "Ballet Flat - Size 6",
          sku: "W-FLAT-BLK-06",
          barcode: "9900000000481",
          purchasePrice: 15,
          sellingPrice: 35,
          stockQuantity: 20,
        },
        {
          name: "Ballet Flat - Size 7",
          sku: "W-FLAT-BLK-07",
          barcode: "9900000000482",
          purchasePrice: 15,
          sellingPrice: 35,
          stockQuantity: 20,
        },
      ],
    },

    // --- KIDS / OTHER ---
    {
      product: {
        name: "Canvas High Tops",
        sku: "SH-CAN-HI",
        barcode: "9900000000300",
        description: "Classic canvas sneakers",
        category: "Kids",
        supplierEmail: "wholesale@urbankicks.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 10,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764153372/pos/products/vtqgw51ackcn42y1daue.png",
      },
      variants: [
        {
          name: "Canvas High Tops - Red",
          sku: "SH-CAN-HI-RED",
          barcode: "9900000000301",
          purchasePrice: 15,
          sellingPrice: 35,
          stockQuantity: 20,
        },
        {
          name: "Canvas High Tops - Blue",
          sku: "SH-CAN-HI-BLU",
          barcode: "9900000000302",
          purchasePrice: 15,
          sellingPrice: 35,
          stockQuantity: 20,
        },
      ],
    },
    {
      product: {
        name: "Hiking Trail Boot",
        sku: "BT-HIKE-UNI",
        barcode: "9900000000600",
        description: "Rugged waterproof hiking boots",
        category: "Boots",
        supplierEmail: "sales@speedsports.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 10,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764151312/pos/products/cjxvb4pidv1ev0wdyvy3.png",
      },
      variants: [
        {
          name: "Hiking Boot - Size 9",
          sku: "BT-HIKE-UNI-09",
          barcode: "9900000000601",
          purchasePrice: 55,
          sellingPrice: 130,
          stockQuantity: 10,
        },
        {
          name: "Hiking Boot - Size 10",
          sku: "BT-HIKE-UNI-10",
          barcode: "9900000000602",
          purchasePrice: 55,
          sellingPrice: 130,
          stockQuantity: 10,
        },
        {
          name: "Hiking Boot - Size 11",
          sku: "BT-HIKE-UNI-11",
          barcode: "9900000000603",
          purchasePrice: 55,
          sellingPrice: 130,
          stockQuantity: 5,
        },
      ],
    },
  ];

  for (const group of footwearData) {
    const p = group.product;
    const supplier = suppliers[p.supplierEmail];
    const category = categories[p.category];

    const created = await upsertProduct(p, store.id, supplier.id, category.id);
    console.log(`Shoe Model ready: ${p.name}`);

    for (const v of group.variants) {
      await upsertVariant(created.id, v);
      console.log(`  Size ready: ${v.name}`);
    }
  }

  console.log("🎉 Shoe Store Seeding Complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
