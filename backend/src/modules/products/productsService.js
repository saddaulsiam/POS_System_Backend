import { PrismaClient } from "@prisma/client";
import bwipjs from "bwip-js";
import ExcelJS from "exceljs";
import { Parser } from "json2csv";
import cloudinary from "../../utils/cloudinary.js";
import { deleteImage } from "../../utils/upload.js";

const prisma = new PrismaClient();

// Get paginated, filtered products
export async function getProductsService({ page, limit, search, categoryId, isActive }) {
  const skip = (page - 1) * limit;
  const where = {};
  // Only filter out deleted if showDeleted is not true
  if (!arguments[0].showDeleted) {
    where.isDeleted = false;
  }
  if (search) {
    where.OR = [{ name: { contains: search } }, { sku: { contains: search } }, { barcode: { contains: search } }];
  }
  if (categoryId) where.categoryId = categoryId;
  if (isActive !== undefined) where.isActive = isActive;
  const [products, total] = await Promise.all([
    prisma.product.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.product.count({ where }),
  ]);
  return {
    data: products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

// Create a new product
export async function createProductService(data, userId) {
  // Auto-generate barcode if not provided
  let barcode = data.barcode;
  if (!barcode) {
    let unique = false;
    let attempt = 0;
    while (!unique && attempt < 10) {
      // Generate a random 12-digit numeric barcode
      barcode = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
      const exists = await prisma.product.findUnique({ where: { barcode } });
      if (!exists) unique = true;
      attempt++;
    }
    if (!unique) throw new Error("Failed to generate unique barcode");
    data.barcode = barcode;
  }
  // Check for duplicate SKU/barcode
  const existing = await prisma.product.findFirst({
    where: {
      OR: [{ sku: data.sku }, { barcode: data.barcode }],
    },
  });
  if (existing) throw new Error("SKU or barcode already exists");
  // Create product
  const product = await prisma.product.create({
    data,
    include: { category: true, supplier: true },
  });
  // ...audit logic if needed...
  return product;
}

// Update product details
export async function updateProductService(id, data) {
  const productId = parseInt(id);
  const existingProduct = await prisma.product.findUnique({ where: { id: productId } });
  if (!existingProduct) throw new Error("Product not found");
  // Check for SKU/barcode conflicts
  if (data.sku || data.barcode) {
    const conflict = await prisma.product.findFirst({
      where: {
        OR: [
          data.sku ? { sku: data.sku, id: { not: productId } } : {},
          data.barcode ? { barcode: data.barcode, id: { not: productId } } : {},
        ],
      },
    });
    if (conflict) throw new Error("SKU or barcode already exists");
  }
  return await prisma.product.update({
    where: { id: productId },
    data,
    include: { category: true, supplier: true },
  });
}

// Soft delete a product
export async function deleteProductService(id) {
  const productId = parseInt(id);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");
  return await prisma.product.update({
    where: { id: productId },
    data: { isActive: false, isDeleted: true },
  });
}

// Get product by ID
export async function getProductByIdService(id) {
  return await prisma.product.findUnique({
    where: { id: parseInt(id) },
    include: { category: true, supplier: true },
  });
}

// Upload product image
export async function uploadProductImageService(id, file) {
  const productId = parseInt(id);
  if (!file) throw new Error("No image uploaded");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");
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
export async function deleteProductImageService(id) {
  const productId = parseInt(id);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");
  if (!product.image) throw new Error("No image to delete");
  // ...delete image file logic if needed...
  return await prisma.product.update({
    where: { id: productId },
    data: { image: null },
    include: { category: true, supplier: true },
  });
}

// Export products as CSV
export async function exportProductsCSVService() {
  const products = await prisma.product.findMany({
    include: { category: true, supplier: true },
    orderBy: { id: "asc" },
  });
  const fields = ["id", "name", "sku", "barcode", "price", "category.name", "supplier.name", "isActive"];
  const parser = new Parser({ fields });
  const csv = parser.parse(
    products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      price: p.price,
      "category.name": p.category?.name || "",
      "supplier.name": p.supplier?.name || "",
      isActive: p.isActive,
    }))
  );
  return csv;
}

// Import products from CSV
export async function importProductsCSVService(buffer) {
  const csv = buffer.toString();
  const rows = csv
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  const headers = rows[0].split(",");
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i].split(",");
    const product = {};
    headers.forEach((h, idx) => (product[h] = values[idx]));
    // Basic upsert
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: { name: product.name, price: parseFloat(product.price), barcode: product.barcode },
      create: {
        name: product.name,
        sku: product.sku,
        price: parseFloat(product.price),
        barcode: product.barcode,
        isActive: true,
      },
    });
  }
  return { success: true };
}

// Export products as Excel
export async function exportProductsExcelService() {
  const products = await prisma.product.findMany({
    include: { category: true, supplier: true },
    orderBy: { name: "asc" },
  });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  sheet.columns = [
    { header: "ID", key: "id" },
    { header: "Name", key: "name" },
    { header: "SKU", key: "sku" },
    { header: "Barcode", key: "barcode" },
    { header: "Price", key: "price" },
    { header: "Category", key: "category" },
    { header: "Supplier", key: "supplier" },
    { header: "Active", key: "isActive" },
  ];
  products.forEach((p) => {
    sheet.addRow({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      price: p.price,
      category: p.category?.name || "",
      supplier: p.supplier?.name || "",
      isActive: p.isActive,
    });
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

// Import products from Excel
export async function importProductsExcelService(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Products");
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const [id, name, sku, barcode, price, category, supplier, isActive] = row.values.slice(1);
    prisma.product.upsert({
      where: { sku },
      update: { name, price: parseFloat(price), barcode },
      create: { name, sku, price: parseFloat(price), barcode, isActive: isActive === "true" },
    });
  });
  return { success: true };
}

// Get product barcode
export async function getProductBarcodeService(id) {
  const product = await prisma.product.findUnique({ where: { id: parseInt(id) } });
  if (!product) throw new Error("Product not found");
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
export async function regenerateProductBarcodeService(id) {
  // Example: generate a new random barcode and update product
  const newBarcode = Math.random().toString(36).substring(2, 12).toUpperCase();
  await prisma.product.update({ where: { id: parseInt(id) }, data: { barcode: newBarcode } });
  return { success: true, barcode: newBarcode };
}
