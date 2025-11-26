import prisma from "../prisma.js";
import { hashPassword } from "../utils/helpers.js";

/**
 * Realistic Clothing Store Seeding Script
 * Store: "Urban Threads Boutique"
 * Focus: Sizes (S, M, L, XL), seasonal collections, with Images.
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
  console.log("👗 Starting Clothing Store seeding...");

  const adminPin = await hashPassword("1234");

  // 1) Setup Store
  console.log("Creating Clothing Store owner...");
  const dummy = await prisma.employee.upsert({
    where: { username: "cloth_owner" },
    update: {},
    create: { name: "Clothing Owner Dummy", username: "cloth_owner", pinCode: adminPin, role: "OWNER" },
  });

  let store = await prisma.store.findFirst({ where: { name: "Urban Threads Boutique" } });
  if (!store) {
    store = await prisma.store.create({ data: { name: "Urban Threads Boutique", ownerId: dummy.id } });
    // after creating store, setup POS settings
    let posSettings = await prisma.pOSSettings.findFirst({ where: { storeId: store.id } });
    if (posSettings) {
      await prisma.pOSSettings.update({
        where: { id: posSettings.id },
        data: { storeName: "Urban Threads Boutique" },
      });
    } else {
      await prisma.pOSSettings.create({
        data: {
          storeName: "Urban Threads Boutique",
          storeId: store.id,
        },
      });
    }
    console.log("Store created: Urban Threads Boutique");
  } else {
    console.log("Store already exists: Urban Threads Boutique");
  }

  const admin = await prisma.employee.upsert({
    where: { username: "cloth_admin" },
    update: {},
    create: { name: "Fashion Manager", username: "cloth_admin", pinCode: adminPin, role: "ADMIN", storeId: store.id },
  });
  await prisma.store.update({ where: { id: store.id }, data: { ownerId: admin.id } });

  // 2) Categories
  const categoryNames = [
    "Men's T-Shirts",
    "Men's Jeans",
    "Women's Dresses",
    "Women's Tops",
    "Outerwear",
    "Activewear",
    "Accessories",
    "Undergarments",
  ];
  const categories = {};
  for (const name of categoryNames) {
    categories[name] = await upsertCategory(name, store.id);
  }

  // 3) Suppliers
  const suppliersData = [
    { name: "Cotton Mills Co.", email: "orders@cottonmills.com", phone: "555-CLOTH-1" },
    { name: "Denim Works", email: "sales@denimworks.com", phone: "555-CLOTH-2" },
    { name: "Luxe Fabrics Import", email: "import@luxefabrics.com", phone: "555-CLOTH-3" },
    { name: "SportStyle Apparels", email: "wholesale@sportstyle.com", phone: "555-CLOTH-4" },
  ];
  const suppliers = {};
  for (const s of suppliersData) {
    suppliers[s.email] = await upsertSupplier(s, store.id);
  }

  // 4) Base Products (Single items / One Size)
  const baseProducts = [
    {
      name: "Leather Belt - Brown",
      sku: "ACC-BLT-BRN",
      barcode: "7700000000001",
      description: "Genuine leather belt",
      category: "Accessories",
      supplierEmail: "import@luxefabrics.com",
      purchasePrice: 8.0,
      sellingPrice: 19.99,
      stockQuantity: 30,
      taxRate: 8,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155353/pos/products/x1oxxxomwfzabwf7jlnk.png",
    },
    {
      name: "Winter Scarf - Grey",
      sku: "ACC-SCF-GRY",
      barcode: "7700000000002",
      description: "Wool blend scarf",
      category: "Accessories",
      supplierEmail: "orders@cottonmills.com",
      purchasePrice: 5.5,
      sellingPrice: 14.99,
      stockQuantity: 40,
      taxRate: 8,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155322/pos/products/xdjupmm5n5mp8iioyiau.png",
    },
    {
      name: "Canvas Tote Bag",
      sku: "ACC-TOT-BG",
      barcode: "7700000000003",
      description: "Eco-friendly shopping tote",
      category: "Accessories",
      supplierEmail: "orders@cottonmills.com",
      purchasePrice: 2.0,
      sellingPrice: 5.0,
      stockQuantity: 100,
      taxRate: 8,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155328/pos/products/dsawg6n2gglh4fi2ivty.png",
    },
    {
      name: "Baseball Cap - Navy",
      sku: "ACC-CAP-NVY",
      barcode: "7700000000004",
      description: "Adjustable cotton baseball cap",
      category: "Accessories",
      supplierEmail: "wholesale@sportstyle.com",
      purchasePrice: 3.5,
      sellingPrice: 12.0,
      stockQuantity: 60,
      taxRate: 8,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155314/pos/products/zjngvovwrjbdmx2fl4a8.png",
    },
    {
      name: "Aviator Sunglasses",
      sku: "ACC-SUN-AVI",
      barcode: "7700000000005",
      description: "Classic metal frame aviators",
      category: "Accessories",
      supplierEmail: "import@luxefabrics.com",
      purchasePrice: 10.0,
      sellingPrice: 25.0,
      stockQuantity: 25,
      taxRate: 8,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155320/pos/products/rfj4ugiuxozc21nwjmg9.png",
    },
    {
      name: "Ankle Socks (3-Pack) White",
      sku: "UND-SCK-WHT",
      barcode: "7700000000006",
      description: "Cotton ankle socks, one size",
      category: "Undergarments",
      supplierEmail: "orders@cottonmills.com",
      purchasePrice: 2.5,
      sellingPrice: 6.99,
      stockQuantity: 150,
      taxRate: 8,
      image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155316/pos/products/tirarm4ccc8azsemhlqa.png",
    },
  ];

  for (const p of baseProducts) {
    const supplier = suppliers[p.supplierEmail];
    const category = categories[p.category];
    await upsertProduct(p, store.id, supplier.id, category.id);
    console.log(`Base Product ready: ${p.name}`);
  }

  // 5) Products with Variants (Sizes S/M/L/XL)
  const productsWithVariants = [
    // --- MEN'S ---
    {
      product: {
        name: "Classic Crew Tee",
        sku: "M-TEE-CREW",
        barcode: "7700000000100",
        description: "100% Cotton Crew Neck T-Shirt",
        category: "Men's T-Shirts",
        supplierEmail: "orders@cottonmills.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 8,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155344/pos/products/kpxup3zppsbycml9uec4.png",
      },
      variants: [
        {
          name: "Classic Crew Tee - S",
          sku: "M-TEE-CREW-S",
          barcode: "7700000000101",
          purchasePrice: 4.0,
          sellingPrice: 12.0,
          stockQuantity: 20,
        },
        {
          name: "Classic Crew Tee - M",
          sku: "M-TEE-CREW-M",
          barcode: "7700000000102",
          purchasePrice: 4.0,
          sellingPrice: 12.0,
          stockQuantity: 35,
        },
        {
          name: "Classic Crew Tee - L",
          sku: "M-TEE-CREW-L",
          barcode: "7700000000103",
          purchasePrice: 4.0,
          sellingPrice: 12.0,
          stockQuantity: 30,
        },
        {
          name: "Classic Crew Tee - XL",
          sku: "M-TEE-CREW-XL",
          barcode: "7700000000104",
          purchasePrice: 4.0,
          sellingPrice: 12.0,
          stockQuantity: 15,
        },
      ],
    },
    {
      product: {
        name: "Slim Fit Jeans",
        sku: "M-JNS-SLM",
        barcode: "7700000000200",
        description: "Dark wash slim fit denim",
        category: "Men's Jeans",
        supplierEmail: "sales@denimworks.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 8,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155294/pos/products/sfukxsxxlv3g2arvgpi3.png",
      },
      variants: [
        {
          name: "Slim Fit Jeans - 30W",
          sku: "M-JNS-SLM-30",
          barcode: "7700000000230",
          purchasePrice: 15.0,
          sellingPrice: 39.99,
          stockQuantity: 10,
        },
        {
          name: "Slim Fit Jeans - 32W",
          sku: "M-JNS-SLM-32",
          barcode: "7700000000232",
          purchasePrice: 15.0,
          sellingPrice: 39.99,
          stockQuantity: 15,
        },
        {
          name: "Slim Fit Jeans - 34W",
          sku: "M-JNS-SLM-34",
          barcode: "7700000000234",
          purchasePrice: 15.0,
          sellingPrice: 39.99,
          stockQuantity: 12,
        },
      ],
    },
    {
      product: {
        name: "Graphic Hoodie",
        sku: "M-HOOD-GR",
        barcode: "7700000000400",
        description: "Fleece lined graphic hoodie",
        category: "Outerwear",
        supplierEmail: "wholesale@sportstyle.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 8,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155295/pos/products/yhrsfnj7u1x1jf0flwtf.png",
      },
      variants: [
        {
          name: "Graphic Hoodie - M",
          sku: "M-HOOD-GR-M",
          barcode: "7700000000401",
          purchasePrice: 12.0,
          sellingPrice: 35.0,
          stockQuantity: 20,
        },
        {
          name: "Graphic Hoodie - L",
          sku: "M-HOOD-GR-L",
          barcode: "7700000000402",
          purchasePrice: 12.0,
          sellingPrice: 35.0,
          stockQuantity: 20,
        },
        {
          name: "Graphic Hoodie - XL",
          sku: "M-HOOD-GR-XL",
          barcode: "7700000000403",
          purchasePrice: 12.0,
          sellingPrice: 35.0,
          stockQuantity: 10,
        },
      ],
    },
    {
      product: {
        name: "Boxer Briefs 3-Pack",
        sku: "M-UND-BOX",
        barcode: "7700000000500",
        description: "Cotton stretch boxer briefs",
        category: "Undergarments",
        supplierEmail: "orders@cottonmills.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 8,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155301/pos/products/cntoyhsllsjqqlrmgyd3.png",
      },
      variants: [
        {
          name: "Boxer Briefs - M",
          sku: "M-UND-BOX-M",
          barcode: "7700000000501",
          purchasePrice: 8.0,
          sellingPrice: 18.0,
          stockQuantity: 40,
        },
        {
          name: "Boxer Briefs - L",
          sku: "M-UND-BOX-L",
          barcode: "7700000000502",
          purchasePrice: 8.0,
          sellingPrice: 18.0,
          stockQuantity: 40,
        },
      ],
    },

    // --- WOMEN'S ---
    {
      product: {
        name: "Summer Floral Dress",
        sku: "W-DRS-FLR",
        barcode: "7700000000300",
        description: "Lightweight summer dress",
        category: "Women's Dresses",
        supplierEmail: "import@luxefabrics.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 8,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155288/pos/products/ygmxevsjp5x5f3md0t2a.png",
      },
      variants: [
        {
          name: "Floral Dress - S",
          sku: "W-DRS-FLR-S",
          barcode: "7700000000301",
          purchasePrice: 12.0,
          sellingPrice: 29.99,
          stockQuantity: 8,
        },
        {
          name: "Floral Dress - M",
          sku: "W-DRS-FLR-M",
          barcode: "7700000000302",
          purchasePrice: 12.0,
          sellingPrice: 29.99,
          stockQuantity: 12,
        },
        {
          name: "Floral Dress - L",
          sku: "W-DRS-FLR-L",
          barcode: "7700000000303",
          purchasePrice: 12.0,
          sellingPrice: 29.99,
          stockQuantity: 6,
        },
      ],
    },
    {
      product: {
        name: "Silk Blouse",
        sku: "W-TOP-SLK",
        barcode: "7700000000600",
        description: "Elegant silk blouse, ivory",
        category: "Women's Tops",
        supplierEmail: "import@luxefabrics.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 8,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155292/pos/products/mqzhiof2nan4ymeb6hd8.png",
      },
      variants: [
        {
          name: "Silk Blouse - S",
          sku: "W-TOP-SLK-S",
          barcode: "7700000000601",
          purchasePrice: 18.0,
          sellingPrice: 45.0,
          stockQuantity: 5,
        },
        {
          name: "Silk Blouse - M",
          sku: "W-TOP-SLK-M",
          barcode: "7700000000602",
          purchasePrice: 18.0,
          sellingPrice: 45.0,
          stockQuantity: 8,
        },
        {
          name: "Silk Blouse - L",
          sku: "W-TOP-SLK-L",
          barcode: "7700000000603",
          purchasePrice: 18.0,
          sellingPrice: 45.0,
          stockQuantity: 6,
        },
      ],
    },
    {
      product: {
        name: "High-Waist Yoga Leggings",
        sku: "W-ACT-LEG",
        barcode: "7700000000700",
        description: "Stretch compression leggings",
        category: "Activewear",
        supplierEmail: "wholesale@sportstyle.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 8,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155293/pos/products/c4vzotcuodxo7aqsssxe.png",
      },
      variants: [
        {
          name: "Yoga Leggings - S",
          sku: "W-ACT-LEG-S",
          barcode: "7700000000701",
          purchasePrice: 10.0,
          sellingPrice: 24.99,
          stockQuantity: 25,
        },
        {
          name: "Yoga Leggings - M",
          sku: "W-ACT-LEG-M",
          barcode: "7700000000702",
          purchasePrice: 10.0,
          sellingPrice: 24.99,
          stockQuantity: 30,
        },
        {
          name: "Yoga Leggings - L",
          sku: "W-ACT-LEG-L",
          barcode: "7700000000703",
          purchasePrice: 10.0,
          sellingPrice: 24.99,
          stockQuantity: 20,
        },
      ],
    },

    // --- UNISEX / OTHER ---
    {
      product: {
        name: "Classic Denim Jacket",
        sku: "U-JKT-DEN",
        barcode: "7700000000800",
        description: "Vintage wash denim jacket",
        category: "Outerwear",
        supplierEmail: "sales@denimworks.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 8,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155188/pos/products/oaaueybztdukhnzkcnoe.png",
      },
      variants: [
        {
          name: "Denim Jacket - S",
          sku: "U-JKT-DEN-S",
          barcode: "7700000000801",
          purchasePrice: 25.0,
          sellingPrice: 59.99,
          stockQuantity: 10,
        },
        {
          name: "Denim Jacket - M",
          sku: "U-JKT-DEN-M",
          barcode: "7700000000802",
          purchasePrice: 25.0,
          sellingPrice: 59.99,
          stockQuantity: 15,
        },
        {
          name: "Denim Jacket - L",
          sku: "U-JKT-DEN-L",
          barcode: "7700000000803",
          purchasePrice: 25.0,
          sellingPrice: 59.99,
          stockQuantity: 12,
        },
        {
          name: "Denim Jacket - XL",
          sku: "U-JKT-DEN-XL",
          barcode: "7700000000804",
          purchasePrice: 25.0,
          sellingPrice: 59.99,
          stockQuantity: 8,
        },
      ],
    },
    {
      product: {
        name: "Performance Running Shorts",
        sku: "M-ACT-SHORT",
        barcode: "7700000000900",
        description: "Lightweight running shorts with liner",
        category: "Activewear",
        supplierEmail: "wholesale@sportstyle.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 8,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155159/pos/products/rycdgcmfsm8yzzjqmcrd.png",
      },
      variants: [
        {
          name: "Running Shorts - M",
          sku: "M-ACT-SHORT-M",
          barcode: "7700000000901",
          purchasePrice: 9.0,
          sellingPrice: 22.0,
          stockQuantity: 20,
        },
        {
          name: "Running Shorts - L",
          sku: "M-ACT-SHORT-L",
          barcode: "7700000000902",
          purchasePrice: 9.0,
          sellingPrice: 22.0,
          stockQuantity: 18,
        },
      ],
    },
    {
      product: {
        name: "Basic Cotton Tank",
        sku: "W-TOP-TANK",
        barcode: "7700000001000",
        description: "Ribbed cotton tank top",
        category: "Women's Tops",
        supplierEmail: "orders@cottonmills.com",
        purchasePrice: 0,
        sellingPrice: 0,
        stockQuantity: 0,
        hasVariants: true,
        taxRate: 8,
        image: "https://res.cloudinary.com/dtkl4ic8s/image/upload/v1764155338/pos/products/tzuixmpo5ogzlpqb5ujt.png",
      },
      variants: [
        {
          name: "Cotton Tank - XS",
          sku: "W-TOP-TANK-XS",
          barcode: "7700000001001",
          purchasePrice: 3.0,
          sellingPrice: 8.5,
          stockQuantity: 20,
        },
        {
          name: "Cotton Tank - S",
          sku: "W-TOP-TANK-S",
          barcode: "7700000001002",
          purchasePrice: 3.0,
          sellingPrice: 8.5,
          stockQuantity: 30,
        },
        {
          name: "Cotton Tank - M",
          sku: "W-TOP-TANK-M",
          barcode: "7700000001003",
          purchasePrice: 3.0,
          sellingPrice: 8.5,
          stockQuantity: 30,
        },
      ],
    },
  ];

  for (const group of productsWithVariants) {
    const p = group.product;
    const supplier = suppliers[p.supplierEmail];
    const category = categories[p.category];

    const created = await upsertProduct(p, store.id, supplier.id, category.id);
    console.log(`Clothing Item ready: ${p.name}`);

    for (const v of group.variants) {
      await upsertVariant(created.id, v);
      console.log(`  Variant ready: ${v.name}`);
    }
  }

  console.log("🎉 Clothing Store Seeding Complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
