const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { getProductsService, createProductService } = require("../services/productsService.js");

async function checkAndCreateAlerts(productId) {
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

// Modularized product listing
async function listProducts(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search;
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : undefined;
    const isActive =
      req.query.isActive !== undefined ? req.query.isActive === "true" || req.query.isActive === true : undefined;
    const result = await getProductsService({ page, limit, search, categoryId, isActive });
    res.json(result);
  } catch (error) {
    console.error("List products error:", error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
}

// Modularized product creation
async function createProduct(req, res) {
  try {
    const result = await createProductService(req.body, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: error.message || "Failed to create product" });
  }
}

async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    const existingProduct = await prisma.product.findUnique({ where: { id: productId } });
    if (!existingProduct) return res.status(404).json({ error: "Product not found" });
    // Check for SKU/barcode conflicts if they're being updated
    if (req.body.sku || req.body.barcode) {
      const conflict = await prisma.product.findFirst({
        where: {
          OR: [
            req.body.sku ? { sku: req.body.sku, id: { not: productId } } : {},
            req.body.barcode ? { barcode: req.body.barcode, id: { not: productId } } : {},
          ],
        },
      });
      if (conflict) return res.status(409).json({ error: "SKU or barcode already exists" });
    }
    const product = await prisma.product.update({
      where: { id: productId },
      data: req.body,
      include: { category: true, supplier: true },
    });
    // Log audit event for product update
    // ...audit logic...
    await checkAndCreateAlerts(product.id);
    res.json(product);
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Failed to update product" });
  }
}

// Delete product (soft delete)
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: "Product not found" });
    await prisma.product.update({ where: { id: productId }, data: { isActive: false } });
    // ...audit logic...
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
}

// Get product by ID
async function getProductById(req, res) {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: { category: true, supplier: true },
    });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
}

// Upload product image
async function uploadProductImage(req, res) {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: "Product not found" });
    // ...delete old image logic...
    const imagePath = `/uploads/products/${req.file.filename}`;
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { image: imagePath },
      include: { category: true, supplier: true },
    });
    res.json(updatedProduct);
  } catch (error) {
    console.error("Upload image error:", error);
    if (req.file) {
      /* delete uploaded file on error */
    }
    res.status(500).json({ error: "Failed to upload image" });
  }
}

// Delete product image
async function deleteProductImage(req, res) {
  try {
    const { id } = req.params;
    const productId = parseInt(id);
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (!product.image) return res.status(400).json({ error: "No image to delete" });
    // ...delete image file logic...
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { image: null },
      include: { category: true, supplier: true },
    });
    res.json(updatedProduct);
  } catch (error) {
    console.error("Delete image error:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
}

//Export products to CSV
async function exportProductsCSV(req, res) {
  try {
    const products = await prisma.product.findMany({
      include: { category: true, supplier: true },
      orderBy: { id: "asc" },
    });
    // ...format and send CSV logic...
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export products" });
  }
}

// Import products from CSV
async function importProductsCSV(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    // ...parse and import logic...
  } catch (error) {
    console.error("Import error:", error);
    res.status(500).json({ error: "Failed to import products", details: error.message });
  }
}

// Export products to Excel
async function exportProductsExcel(req, res) {
  try {
    const products = await prisma.product.findMany({
      include: { category: true, supplier: true },
      orderBy: { name: "asc" },
    });
    // ...format and send Excel logic...
  } catch (error) {
    console.error("Export Excel error:", error);
    res.status(500).json({ error: "Failed to export products to Excel" });
  }
}

// Import products from Excel
async function importProductsExcel(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    // ...parse and import logic...
  } catch (error) {
    console.error("Excel import error:", error);
    res.status(500).json({ error: "Failed to import Excel file", details: error.message });
  }
}

// Generate barcode image for a product
async function getProductBarcode(req, res) {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id: parseInt(id) } });
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (!product.barcode) return res.status(400).json({ error: "No barcode for product" });
    // ...barcode image logic...
  } catch (error) {
    res.status(500).json({ error: "Failed to generate barcode" });
  }
}

// Regenerate barcode for a product
async function regenerateProductBarcode(req, res) {
  try {
    const { id } = req.params;
    // ...regenerate barcode logic...
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to regenerate barcode" });
  }
}

module.exports = {
  checkAndCreateAlerts,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductById,
  uploadProductImage,
  deleteProductImage,
  exportProductsCSV,
  importProductsCSV,
  exportProductsExcel,
  importProductsExcel,
  getProductBarcode,
  regenerateProductBarcode,
};
