import prisma from "../../prisma.js";
import bwipjs from "bwip-js";
import ExcelJS from "exceljs";
import { Parser } from "json2csv";
import Papa from "papaparse";
import cloudinary from "../../utils/cloudinary.js";
import { deleteImage } from "../../utils/upload.js";

// Get paginated, filtered products (store isolated)
export async function getProductsService({ page, limit, search, categoryId, isActive, showDeleted, storeId }) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const skip = (page - 1) * limit;
  const where = { storeId };
  // Only filter out deleted if showDeleted is not true
  if (!showDeleted) {
    where.isDeleted = false;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" }, storeId },
      { sku: { contains: search, mode: "insensitive" }, storeId },
      { barcode: { contains: search, mode: "insensitive" }, storeId },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (isActive !== undefined) where.isActive = isActive;
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        category: true,
        supplier: true,
        variants: {
          where: { isActive: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const processedProducts = products.map((product) => {
    if (product.hasVariants && product.variants && product.variants.length > 0) {
      const totalVariantStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0);
      return {
        ...product,
        stockQuantity: totalVariantStock,
      };
    }
    return product;
  });

  return {
    data: processedProducts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

// Create a new product

// Create a new product (store isolated)
export async function createProductService(data, userId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  // Auto-generate barcode if not provided
  let barcode = data.barcode;
  if (!barcode) {
    let unique = false;
    let attempt = 0;
    while (!unique && attempt < 10) {
      // Generate a random 12-digit numeric barcode
      barcode = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
      const exists = await prisma.product.findFirst({ where: { barcode, storeId } });
      if (!exists) unique = true;
      attempt++;
    }
    if (!unique) throw new Error("Failed to generate unique barcode");
    data.barcode = barcode;
  }
  // Check for duplicate SKU/barcode scoped to storeId
  const existing = await prisma.product.findFirst({
    where: {
      storeId,
      OR: [{ sku: data.sku }, { barcode: data.barcode }],
    },
  });
  if (existing) throw new Error("SKU or barcode already exists in this store");
  // Set storeId on product
  data.storeId = storeId;
  // Create product
  const product = await prisma.product.create({
    data,
    include: { category: true, supplier: true },
  });
  // ...audit logic if needed...
  return product;
}

// Update product details

// Update product details (store isolated)
export async function updateProductService(id, data, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const productId = parseInt(id);
  // Only allow update if product belongs to this store
  const existingProduct = await prisma.product.findFirst({ where: { id: productId, storeId } });
  if (!existingProduct) throw new Error("Product not found in this store");
  // Check for SKU/barcode conflicts scoped to storeId
  if (data.sku || data.barcode) {
    const conflict = await prisma.product.findFirst({
      where: {
        storeId,
        OR: [
          data.sku ? { sku: data.sku, id: { not: productId } } : {},
          data.barcode ? { barcode: data.barcode, id: { not: productId } } : {},
        ],
      },
    });
    if (conflict) throw new Error("SKU or barcode already exists in this store");
  }
  return await prisma.product.update({
    where: { id: productId },
    data,
    include: { category: true, supplier: true },
  });
}

// Soft delete a product

// Soft delete a product (store isolated)
export async function deleteProductService(id, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const productId = parseInt(id);
  // Only allow delete if product belongs to this store
  const product = await prisma.product.findFirst({ where: { id: productId, storeId } });
  if (!product) throw new Error("Product not found in this store");
  return await prisma.product.update({
    where: { id: productId },
    data: { isActive: false, isDeleted: true },
  });
}

// Get product by ID

export async function getProductByIdService(id, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const product = await prisma.product.findFirst({
    where: { id: parseInt(id), storeId },
    include: {
      category: true,
      supplier: true,
      variants: {
        where: { isActive: true },
      },
    },
  });
  if (product && product.hasVariants && product.variants && product.variants.length > 0) {
    const totalVariantStock = product.variants.reduce((sum, v) => sum + v.stockQuantity, 0);
    product.stockQuantity = totalVariantStock;
  }
  return product;
}

// Upload product image

// Upload product image (store isolated)
export async function uploadProductImageService(id, file, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const productId = parseInt(id);
  if (!file) throw new Error("No image uploaded");
  const product = await prisma.product.findFirst({ where: { id: productId, storeId } });
  if (!product) throw new Error("Product not found in this store");
  // If previous image was stored locally, delete it
  try {
    if (product.image && product.image.startsWith("/uploads")) {
      deleteImage(product.image);
    }
  } catch (err) {
    console.error("Error deleting old image:", err);
  }

  let imageUrl = null;

  // If file.buffer exists, upload directly to Cloudinary
  if (file.buffer) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "pos/products", resource_type: "image" },
          (error, res) => {
            if (error) return reject(error);
            resolve(res);
          }
        );
        stream.end(file.buffer);
      });
      imageUrl = result.secure_url;
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      throw new Error("Failed to upload image to Cloudinary");
    }
  } else if (file.path) {
    // If multer saved to disk (fallback), upload the file path to Cloudinary
    try {
      const res = await cloudinary.uploader.upload(file.path, { folder: "pos/products", resource_type: "image" });
      imageUrl = res.secure_url;
    } catch (err) {
      console.error("Cloudinary upload error from path:", err);
      // Fallback to local path if Cloudinary fails
      imageUrl = `/uploads/products/${file.filename}`;
    }
  } else if (file.filename) {
    // Fallback: keep local path
    imageUrl = `/uploads/products/${file.filename}`;
  }

  return await prisma.product.update({
    where: { id: productId },
    data: { image: imageUrl },
    include: { category: true, supplier: true },
  });
}

// Delete product image

// Delete product image (store isolated)
export async function deleteProductImageService(id, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const productId = parseInt(id);
  const product = await prisma.product.findFirst({ where: { id: productId, storeId } });
  if (!product) throw new Error("Product not found in this store");
  if (!product.image) throw new Error("No image to delete");
  // ...delete image file logic if needed...
  return await prisma.product.update({
    where: { id: productId },
    data: { image: null },
    include: { category: true, supplier: true },
  });
}

// Export products as CSV

// Export products as CSV (store isolated)
export async function exportProductsCSVService(storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const products = await prisma.product.findMany({
    where: { storeId, isDeleted: false },
    include: { category: true, supplier: true },
    orderBy: { name: "asc" },
  });
  const fields = [
    "name",
    "sku",
    "barcode",
    "description",
    "purchasePrice",
    "sellingPrice",
    "stockQuantity",
    "lowStockThreshold",
    "taxRate",
    "unit",
    "isWeighted",
    "category",
    "supplier",
    "isActive",
  ];
  const parser = new Parser({ fields });
  const csv = parser.parse(
    products.map((p) => ({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || "",
      description: p.description || "",
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      taxRate: p.taxRate,
      unit: p.unit || "pcs",
      isWeighted: p.isWeighted,
      category: p.category?.name || "",
      supplier: p.supplier?.name || "",
      isActive: p.isActive,
    }))
  );
  return csv;
}

// Import products from CSV

// Import products from CSV (store isolated)
export async function importProductsCSVService(buffer, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const csvString = buffer.toString("utf8");
  const parsed = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors && parsed.errors.length > 0) {
    throw new Error(`CSV Parsing error: ${parsed.errors[0].message}`);
  }

  const rows = parsed.data;
  for (const row of rows) {
    const name = row.name?.trim();
    const sku = row.sku?.trim();
    if (!name || !sku) continue;

    const barcode = row.barcode?.trim() || null;
    const description = row.description?.trim() || null;
    const purchasePrice = parseFloat(row.purchasePrice) || 0;
    const sellingPrice = parseFloat(row.sellingPrice) || 0;
    const stockQuantity = parseFloat(row.stockQuantity) || 0;
    const lowStockThreshold = parseInt(row.lowStockThreshold) || 10;
    const taxRate = parseFloat(row.taxRate) || 0;
    const unit = row.unit?.trim() || "pcs";
    const isWeighted = row.isWeighted === "true" || row.isWeighted === true;
    const isActive = row.isActive === undefined || row.isActive === "true" || row.isActive === true;

    // Handle Category
    let categoryId = null;
    if (row.category?.trim()) {
      const categoryName = row.category.trim();
      const cat = await prisma.category.upsert({
        where: { storeId_name: { storeId, name: categoryName } },
        update: {},
        create: { name: categoryName, storeId },
      });
      categoryId = cat.id;
    } else {
      const cat = await prisma.category.upsert({
        where: { storeId_name: { storeId, name: "General" } },
        update: {},
        create: { name: "General", storeId },
      });
      categoryId = cat.id;
    }

    // Handle Supplier
    let supplierId = null;
    if (row.supplier?.trim()) {
      const supplierName = row.supplier.trim();
      let sup = await prisma.supplier.findFirst({
        where: { name: supplierName, storeId },
      });
      if (!sup) {
        sup = await prisma.supplier.create({
          data: { name: supplierName, storeId },
        });
      }
      supplierId = sup.id;
    }

    // Check if sku exists in database for this store
    const existing = await prisma.product.findUnique({
      where: { storeId_sku: { storeId, sku } },
    });

    if (existing) {
      // Update
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name,
          barcode,
          description,
          purchasePrice,
          sellingPrice,
          stockQuantity,
          lowStockThreshold,
          taxRate,
          unit,
          isWeighted,
          isActive,
          categoryId,
          supplierId,
        },
      });
    } else {
      // Create
      await prisma.product.create({
        data: {
          storeId,
          name,
          sku,
          barcode,
          description,
          purchasePrice,
          sellingPrice,
          stockQuantity,
          lowStockThreshold,
          taxRate,
          unit,
          isWeighted,
          isActive,
          categoryId,
          supplierId,
        },
      });
    }
  }

  return { success: true };
}

// Export products as Excel

// Export products as Excel (store isolated)
export async function exportProductsExcelService(storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const products = await prisma.product.findMany({
    where: { storeId, isDeleted: false },
    include: { category: true, supplier: true },
    orderBy: { name: "asc" },
  });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  sheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "SKU", key: "sku", width: 15 },
    { header: "Barcode", key: "barcode", width: 15 },
    { header: "Description", key: "description", width: 30 },
    { header: "Purchase Price", key: "purchasePrice", width: 15 },
    { header: "Selling Price", key: "sellingPrice", width: 15 },
    { header: "Stock Quantity", key: "stockQuantity", width: 15 },
    { header: "Low Stock Threshold", key: "lowStockThreshold", width: 18 },
    { header: "Tax Rate", key: "taxRate", width: 10 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Is Weighted", key: "isWeighted", width: 12 },
    { header: "Category", key: "category", width: 20 },
    { header: "Supplier", key: "supplier", width: 20 },
    { header: "Active", key: "isActive", width: 10 },
  ];
  products.forEach((p) => {
    sheet.addRow({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || "",
      description: p.description || "",
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      taxRate: p.taxRate,
      unit: p.unit || "pcs",
      isWeighted: p.isWeighted ? "true" : "false",
      category: p.category?.name || "",
      supplier: p.supplier?.name || "",
      isActive: p.isActive ? "true" : "false",
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// Import products from Excel

// Import products from Excel (store isolated)
export async function importProductsExcelService(buffer, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Products") || workbook.worksheets[0];
  if (!sheet) throw new Error("Excel worksheet not found");

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    if (values.length < 2) return;
    rows.push({
      name: values[0]?.toString() || "",
      sku: values[1]?.toString() || "",
      barcode: values[2]?.toString() || "",
      description: values[3]?.toString() || "",
      purchasePrice: parseFloat(values[4]) || 0,
      sellingPrice: parseFloat(values[5]) || 0,
      stockQuantity: parseFloat(values[6]) || 0,
      lowStockThreshold: parseInt(values[7]) || 10,
      taxRate: parseFloat(values[8]) || 0,
      unit: values[9]?.toString() || "pcs",
      isWeighted: values[10]?.toString() === "true",
      category: values[11]?.toString() || "",
      supplier: values[12]?.toString() || "",
      isActive: values[13]?.toString() !== "false",
    });
  });

  for (const row of rows) {
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
      unit,
      isWeighted,
      category,
      supplier,
      isActive,
    } = row;

    if (!name || !sku) continue;

    // Handle Category
    let categoryId = null;
    if (category?.trim()) {
      const categoryName = category.trim();
      const cat = await prisma.category.upsert({
        where: { storeId_name: { storeId, name: categoryName } },
        update: {},
        create: { name: categoryName, storeId },
      });
      categoryId = cat.id;
    } else {
      const cat = await prisma.category.upsert({
        where: { storeId_name: { storeId, name: "General" } },
        update: {},
        create: { name: "General", storeId },
      });
      categoryId = cat.id;
    }

    // Handle Supplier
    let supplierId = null;
    if (supplier?.trim()) {
      const supplierName = supplier.trim();
      let sup = await prisma.supplier.findFirst({
        where: { name: supplierName, storeId },
      });
      if (!sup) {
        sup = await prisma.supplier.create({
          data: { name: supplierName, storeId },
        });
      }
      supplierId = sup.id;
    }

    // Check if sku exists in database for this store
    const existing = await prisma.product.findUnique({
      where: { storeId_sku: { storeId, sku } },
    });

    if (existing) {
      // Update
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name,
          barcode: barcode || null,
          description: description || null,
          purchasePrice,
          sellingPrice,
          stockQuantity,
          lowStockThreshold,
          taxRate,
          unit,
          isWeighted,
          isActive,
          categoryId,
          supplierId,
        },
      });
    } else {
      // Create
      await prisma.product.create({
        data: {
          storeId,
          name,
          sku,
          barcode: barcode || null,
          description: description || null,
          purchasePrice,
          sellingPrice,
          stockQuantity,
          lowStockThreshold,
          taxRate,
          unit,
          isWeighted,
          isActive,
          categoryId,
          supplierId,
        },
      });
    }
  }

  return { success: true };
}

// Get product barcode

// Get product barcode (store isolated)
export async function getProductBarcodeService(id, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const product = await prisma.product.findFirst({ where: { id: parseInt(id), storeId } });
  if (!product) throw new Error("Product not found in this store");
  if (!product.barcode) throw new Error("No barcode for product");
  // Generate barcode image as PNG buffer
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text: product.barcode,
    scale: 3,
    height: 10,
    includetext: true,
  });
  return { barcode: product.barcode, image: png };
}

// Regenerate product barcode

// Regenerate product barcode (store isolated)
export async function regenerateProductBarcodeService(id, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  // Only allow if product belongs to this store
  const product = await prisma.product.findFirst({ where: { id: parseInt(id), storeId } });
  if (!product) throw new Error("Product not found in this store");
  // Example: generate a new random barcode and update product
  const newBarcode = Math.random().toString(36).substring(2, 12).toUpperCase();
  await prisma.product.update({ where: { id: parseInt(id) }, data: { barcode: newBarcode } });
  return { success: true, barcode: newBarcode };
}

// Download templates
export async function downloadCSVTemplateService() {
  const fields = [
    "name",
    "sku",
    "barcode",
    "description",
    "purchasePrice",
    "sellingPrice",
    "stockQuantity",
    "lowStockThreshold",
    "taxRate",
    "unit",
    "isWeighted",
    "category",
    "supplier",
    "isActive",
  ];
  const sampleData = [
    {
      name: "Sample Product",
      sku: "PROD-SAMPLE-001",
      barcode: "123456789012",
      description: "This is a sample product description",
      purchasePrice: 10.0,
      sellingPrice: 15.0,
      stockQuantity: 100,
      lowStockThreshold: 10,
      taxRate: 5.0,
      unit: "pcs",
      isWeighted: false,
      category: "General",
      supplier: "Default Supplier",
      isActive: true,
    },
  ];
  const parser = new Parser({ fields });
  return parser.parse(sampleData);
}

export async function downloadExcelTemplateService() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  sheet.columns = [
    { header: "Name", key: "name", width: 30 },
    { header: "SKU", key: "sku", width: 15 },
    { header: "Barcode", key: "barcode", width: 15 },
    { header: "Description", key: "description", width: 30 },
    { header: "Purchase Price", key: "purchasePrice", width: 15 },
    { header: "Selling Price", key: "sellingPrice", width: 15 },
    { header: "Stock Quantity", key: "stockQuantity", width: 15 },
    { header: "Low Stock Threshold", key: "lowStockThreshold", width: 18 },
    { header: "Tax Rate", key: "taxRate", width: 10 },
    { header: "Unit", key: "unit", width: 10 },
    { header: "Is Weighted", key: "isWeighted", width: 12 },
    { header: "Category", key: "category", width: 20 },
    { header: "Supplier", key: "supplier", width: 20 },
    { header: "Active", key: "isActive", width: 10 },
  ];
  sheet.addRow({
    name: "Sample Product",
    sku: "PROD-SAMPLE-001",
    barcode: "123456789012",
    description: "This is a sample product description",
    purchasePrice: 10.0,
    sellingPrice: 15.0,
    stockQuantity: 100,
    lowStockThreshold: 10,
    taxRate: 5.0,
    unit: "pcs",
    isWeighted: "false",
    category: "General",
    supplier: "Default Supplier",
    isActive: "true",
  });
  return await workbook.xlsx.writeBuffer();
}
