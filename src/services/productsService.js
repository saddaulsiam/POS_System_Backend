// Modular service for products
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function getProductsService({ page, limit, search, categoryId, isActive }) {
  const skip = (page - 1) * limit;
  const where = {};
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
    products,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

async function createProductService(data, userId) {
  // Check for duplicate SKU/barcode
  const existing = await prisma.product.findFirst({
    where: {
      OR: [{ sku: data.sku }, data.barcode ? { barcode: data.barcode } : {}],
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

async function updateProductService(id, data) {
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

async function deleteProductService(id) {
  const productId = parseInt(id);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");
  return await prisma.product.update({
    where: { id: productId },
    data: { isActive: false },
  });
}

async function getProductByIdService(id) {
  return await prisma.product.findUnique({
    where: { id: parseInt(id) },
    include: { category: true, supplier: true },
  });
}

async function uploadProductImageService(id, file) {
  const productId = parseInt(id);
  if (!file) throw new Error("No image uploaded");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");
  // ...delete old image logic if needed...
  const imagePath = `/uploads/products/${file.filename}`;
  return await prisma.product.update({
    where: { id: productId },
    data: { image: imagePath },
    include: { category: true, supplier: true },
  });
}

async function deleteProductImageService(id) {
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

async function exportProductsCSVService() {
  const products = await prisma.product.findMany({
    include: { category: true, supplier: true },
    orderBy: { id: "asc" },
  });
  // ...format and return CSV data...
  return products;
}

async function importProductsCSVService(data) {
  // ...parse and import logic...
  return { success: true };
}

async function exportProductsExcelService() {
  const products = await prisma.product.findMany({
    include: { category: true, supplier: true },
    orderBy: { name: "asc" },
  });
  // ...format and return Excel data...
  return products;
}

async function importProductsExcelService(data) {
  // ...parse and import logic...
  return { success: true };
}

async function getProductBarcodeService(id) {
  const product = await prisma.product.findUnique({ where: { id: parseInt(id) } });
  if (!product) throw new Error("Product not found");
  if (!product.barcode) throw new Error("No barcode for product");
  // ...barcode image logic...
  return { barcode: product.barcode };
}

async function regenerateProductBarcodeService(id) {
  // ...regenerate barcode logic...
  return { success: true };
}

module.exports = {
  getProductsService,
  createProductService,
  updateProductService,
  deleteProductService,
  getProductByIdService,
  uploadProductImageService,
  deleteProductImageService,
  exportProductsCSVService,
  importProductsCSVService,
  exportProductsExcelService,
  importProductsExcelService,
  getProductBarcodeService,
  regenerateProductBarcodeService,
};
