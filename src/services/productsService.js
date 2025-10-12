import { PrismaClient } from "@prisma/client";
import bwipjs from "bwip-js";
import ExcelJS from "exceljs";
import { Parser } from "json2csv";

const prisma = new PrismaClient();

// Alerts for product status changes
export async function checkAndCreateAlerts(productId) {
  const settings = await prisma.pOSSettings.findFirst();
  const product = await prisma.product.findUnique({ where: { id: productId } });

  // Low Stock Alert
  if (settings?.enableLowStockAlerts && product.stockQuantity <= settings.lowStockThreshold) {
    await prisma.notification.create({
      data: {
        type: "low_stock",
        message: `Stock for ${product.name} is low (${product.stockQuantity} left)`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // High Stock Alert
  if (settings?.enableHighStockAlerts && product.stockQuantity >= settings.highStockThreshold) {
    await prisma.notification.create({
      data: {
        type: "high_stock",
        message: `Stock for ${product.name} is high (${product.stockQuantity} units)`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Expiry Alert
  if (settings?.enableProductExpiryAlerts && product.expiryDate && new Date(product.expiryDate) < new Date()) {
    await prisma.notification.create({
      data: {
        type: "expiry",
        message: `Product ${product.name} has expired.`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Inactive Product Alert
  if (
    settings?.inactiveProductAlertEnabled &&
    product.lastSoldDate &&
    (new Date() - new Date(product.lastSoldDate)) / (1000 * 60 * 60 * 24) > settings.inactiveProductDays
  ) {
    await prisma.notification.create({
      data: {
        type: "inactive",
        message: `Product ${product.name} has not been sold for ${settings.inactiveProductDays} days.`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // System Error Alert
  if (settings?.systemErrorAlertEnabled && product.hasError) {
    await prisma.notification.create({
      data: {
        type: "system_error",
        message: `System error detected for product ${product.name}.`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Price Change Alert
  if (settings?.priceChangeAlertEnabled && product.priceChanged) {
    await prisma.notification.create({
      data: {
        type: "price_change",
        message: `Price changed for product ${product.name}.`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Supplier Delivery Alert
  if (settings?.supplierDeliveryAlertEnabled && product.expectedDeliveryDate) {
    const daysUntilDelivery = (new Date(product.expectedDeliveryDate) - new Date()) / (1000 * 60 * 60 * 24);
    if (daysUntilDelivery < settings.expectedDeliveryDays) {
      await prisma.notification.create({
        data: {
          type: "supplier_delivery",
          message: `Supplier delivery for ${product.name} expected in ${Math.ceil(daysUntilDelivery)} days.`,
          productId: product.id,
          isRead: false,
        },
      });
    }
  }

  // Low Balance Alert
  if (
    settings?.lowBalanceAlertEnabled &&
    product.balance !== undefined &&
    product.balance < settings.lowBalanceThreshold
  ) {
    await prisma.notification.create({
      data: {
        type: "low_balance",
        message: `Balance for ${product.name} is low (${product.balance}).`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Frequent Refunds Alert
  if (
    settings?.frequentRefundsAlertEnabled &&
    product.refundCount !== undefined &&
    product.refundCount > settings.frequentRefundsThreshold
  ) {
    await prisma.notification.create({
      data: {
        type: "frequent_refunds",
        message: `Frequent refunds for ${product.name} (${product.refundCount} times).`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Daily Sales Target Alert
  if (
    settings?.dailySalesTargetAlertEnabled &&
    product.dailySales !== undefined &&
    product.dailySales < settings.dailySalesTargetAmount
  ) {
    await prisma.notification.create({
      data: {
        type: "daily_sales_target",
        message: `Daily sales for ${product.name} below target (${product.dailySales}/${settings.dailySalesTargetAmount}).`,
        productId: product.id,
        isRead: false,
      },
    });
  }

  // Loyalty Points Expiry Alert
  if (
    settings?.loyaltyPointsExpiryAlertEnabled &&
    product.loyaltyPointsExpiryDate &&
    new Date(product.loyaltyPointsExpiryDate) < new Date()
  ) {
    await prisma.notification.create({
      data: {
        type: "loyalty_points_expiry",
        message: `Loyalty points for ${product.name} have expired.`,
        productId: product.id,
        isRead: false,
      },
    });
  }
}

// Get paginated, filtered products
export async function getProductsService({ page, limit, search, categoryId, isActive }) {
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

// Create a new product
export async function createProductService(data, userId) {
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
    data: { isActive: false },
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
  // ...delete old image logic if needed...
  const imagePath = `/uploads/products/${file.filename}`;
  return await prisma.product.update({
    where: { id: productId },
    data: { image: imagePath },
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
