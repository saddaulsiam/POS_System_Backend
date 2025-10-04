const XLSX = require("xlsx");

/**
 * Parse Excel file buffer to JSON
 * @param {Buffer} buffer - Excel file buffer
 * @returns {Array} Array of objects from first sheet
 */
const parseExcel = (buffer) => {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, {
      raw: false, // Use formatted strings
      defval: "", // Default value for empty cells
    });
    return { data, errors: [] };
  } catch (error) {
    return { data: [], errors: [{ message: error.message }] };
  }
};

/**
 * Convert JSON data to Excel buffer
 * @param {Array} data - Array of objects
 * @param {String} sheetName - Name of the sheet (default: "Sheet1")
 * @returns {Buffer} Excel file buffer
 */
const jsonToExcel = (data, sheetName = "Sheet1") => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate buffer
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer;
};

/**
 * Generate Excel template for product import
 * @returns {Buffer} Excel template buffer
 */
const generateProductImportTemplate = () => {
  const template = [
    {
      name: "Example Product",
      sku: "SKU001",
      barcode: "1234567890123",
      description: "Product description",
      categoryId: 1,
      supplierId: 1,
      purchasePrice: 10.5,
      sellingPrice: 15.0,
      stockQuantity: 100,
      lowStockThreshold: 10,
      isWeighted: false,
      isActive: true,
      taxRate: 0,
      unit: "pcs",
    },
  ];

  return jsonToExcel(template, "Products Template");
};

/**
 * Generate Excel template for product variants import
 * @returns {Buffer} Excel template buffer
 */
const generateVariantImportTemplate = () => {
  const template = [
    {
      productId: 1,
      name: "500ml",
      sku: "PROD-500ML",
      barcode: "1234567890001",
      purchasePrice: 5.0,
      sellingPrice: 8.0,
      stockQuantity: 50,
      isActive: true,
    },
    {
      productId: 1,
      name: "1L",
      sku: "PROD-1L",
      barcode: "1234567890002",
      purchasePrice: 9.0,
      sellingPrice: 14.0,
      stockQuantity: 30,
      isActive: true,
    },
  ];

  return jsonToExcel(template, "Variants Template");
};

/**
 * Validate and format product data from import
 * @param {Array} products - Array of product objects
 * @returns {Object} { valid: Array, invalid: Array }
 */
const validateProductExcelData = (products) => {
  const valid = [];
  const invalid = [];

  products.forEach((product, index) => {
    const errors = [];
    const row = index + 2; // Excel row (header is row 1)

    // Required fields
    if (!product.name || String(product.name).trim() === "") {
      errors.push("Name is required");
    }
    if (!product.sku || String(product.sku).trim() === "") {
      errors.push("SKU is required");
    }
    if (!product.categoryId) {
      errors.push("Category ID is required");
    }
    if (product.purchasePrice === undefined || product.purchasePrice === "") {
      errors.push("Purchase Price is required");
    }
    if (product.sellingPrice === undefined || product.sellingPrice === "") {
      errors.push("Selling Price is required");
    }

    // Parse and validate numbers
    const categoryId = parseInt(product.categoryId);
    const supplierId = product.supplierId ? parseInt(product.supplierId) : null;
    const purchasePrice = parseFloat(product.purchasePrice);
    const sellingPrice = parseFloat(product.sellingPrice);
    const stockQuantity = parseFloat(product.stockQuantity || "0");
    const lowStockThreshold = parseInt(product.lowStockThreshold || "10");
    const taxRate = parseFloat(product.taxRate || "0");

    if (isNaN(categoryId) || categoryId <= 0) {
      errors.push("Category ID must be a positive number");
    }
    if (supplierId !== null && (isNaN(supplierId) || supplierId <= 0)) {
      errors.push("Supplier ID must be a positive number");
    }
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      errors.push("Purchase Price must be >= 0");
    }
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      errors.push("Selling Price must be >= 0");
    }
    if (isNaN(stockQuantity) || stockQuantity < 0) {
      errors.push("Stock Quantity must be >= 0");
    }
    if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
      errors.push("Low Stock Threshold must be >= 0");
    }
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      errors.push("Tax Rate must be between 0 and 100");
    }

    // Parse booleans
    const isActive =
      product.isActive === true || product.isActive === "true" || product.isActive === "1" || product.isActive === 1;
    const isWeighted =
      product.isWeighted === true ||
      product.isWeighted === "true" ||
      product.isWeighted === "1" ||
      product.isWeighted === 1;

    if (errors.length > 0) {
      invalid.push({ row, data: product, errors });
    } else {
      valid.push({
        name: String(product.name).trim(),
        sku: String(product.sku).trim(),
        barcode: product.barcode ? String(product.barcode).trim() : null,
        description: product.description ? String(product.description).trim() : null,
        categoryId,
        supplierId,
        purchasePrice,
        sellingPrice,
        stockQuantity,
        lowStockThreshold,
        isWeighted,
        isActive,
        taxRate,
        unit: product.unit ? String(product.unit).trim() : "pcs",
      });
    }
  });

  return { valid, invalid };
};

/**
 * Validate and format variant data from import
 * @param {Array} variants - Array of variant objects
 * @returns {Object} { valid: Array, invalid: Array }
 */
const validateVariantExcelData = (variants) => {
  const valid = [];
  const invalid = [];

  variants.forEach((variant, index) => {
    const errors = [];
    const row = index + 2;

    // Required fields
    if (!variant.productId) {
      errors.push("Product ID is required");
    }
    if (!variant.name || String(variant.name).trim() === "") {
      errors.push("Variant name is required");
    }
    if (!variant.sku || String(variant.sku).trim() === "") {
      errors.push("SKU is required");
    }
    if (variant.purchasePrice === undefined || variant.purchasePrice === "") {
      errors.push("Purchase Price is required");
    }
    if (variant.sellingPrice === undefined || variant.sellingPrice === "") {
      errors.push("Selling Price is required");
    }

    // Parse and validate
    const productId = parseInt(variant.productId);
    const purchasePrice = parseFloat(variant.purchasePrice);
    const sellingPrice = parseFloat(variant.sellingPrice);
    const stockQuantity = parseFloat(variant.stockQuantity || "0");

    if (isNaN(productId) || productId <= 0) {
      errors.push("Product ID must be a positive number");
    }
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      errors.push("Purchase Price must be >= 0");
    }
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      errors.push("Selling Price must be >= 0");
    }
    if (isNaN(stockQuantity) || stockQuantity < 0) {
      errors.push("Stock Quantity must be >= 0");
    }

    const isActive =
      variant.isActive === true || variant.isActive === "true" || variant.isActive === "1" || variant.isActive === 1;

    if (errors.length > 0) {
      invalid.push({ row, data: variant, errors });
    } else {
      valid.push({
        productId,
        name: String(variant.name).trim(),
        sku: String(variant.sku).trim(),
        barcode: variant.barcode ? String(variant.barcode).trim() : null,
        purchasePrice,
        sellingPrice,
        stockQuantity,
        isActive,
      });
    }
  });

  return { valid, invalid };
};

module.exports = {
  parseExcel,
  jsonToExcel,
  generateProductImportTemplate,
  generateVariantImportTemplate,
  validateProductExcelData,
  validateVariantExcelData,
};
