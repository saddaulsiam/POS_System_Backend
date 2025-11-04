const Papa = require("papaparse");

/**
 * Parse CSV data to JSON
 * @param {string} csvData - CSV content as string
 * @returns {Object} { data: Array, errors: Array }
 */
const parseCSV = (csvData) => {
  const result = Papa.parse(csvData, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  return result;
};

/**
 * Convert JSON data to CSV
 * @param {Array} data - Array of objects to convert
 * @returns {string} CSV string
 */
const jsonToCSV = (data) => {
  return Papa.unparse(data);
};

/**
 * Validate product import data
 * @param {Array} products - Array of product objects
 * @returns {Object} { valid: Array, invalid: Array }
 */
const validateProductImport = (products) => {
  const valid = [];
  const invalid = [];

  products.forEach((product, index) => {
    const errors = [];
    const row = index + 2; // +2 because index is 0-based and we skip header

    // Required fields validation
    if (!product.name || product.name.trim() === "") {
      errors.push("Name is required");
    }
    if (!product.sku || product.sku.trim() === "") {
      errors.push("SKU is required");
    }
    if (!product.categoryId) {
      errors.push("Category ID is required");
    }
    if (!product.purchasePrice) {
      errors.push("Purchase Price is required");
    }
    if (!product.sellingPrice) {
      errors.push("Selling Price is required");
    }
    if (!product.stockQuantity) {
      errors.push("Stock Quantity is required");
    }

    // Type validation
    const categoryId = parseInt(product.categoryId);
    const purchasePrice = parseFloat(product.purchasePrice);
    const sellingPrice = parseFloat(product.sellingPrice);
    const stockQuantity = parseFloat(product.stockQuantity);
    const lowStockThreshold = parseInt(product.lowStockThreshold || "10");
    const taxRate = parseFloat(product.taxRate || "0");

    if (isNaN(categoryId)) {
      errors.push("Category ID must be a number");
    }
    if (isNaN(purchasePrice) || purchasePrice < 0) {
      errors.push("Purchase Price must be a positive number");
    }
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      errors.push("Selling Price must be a positive number");
    }
    if (isNaN(stockQuantity) || stockQuantity < 0) {
      errors.push("Stock Quantity must be a positive number");
    }
    if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
      errors.push("Low Stock Threshold must be a positive number");
    }
    if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
      errors.push("Tax Rate must be between 0 and 100");
    }

    // Boolean validation
    const isActive = product.isActive === "true" || product.isActive === "1" || product.isActive === true;
    const isWeighted = product.isWeighted === "true" || product.isWeighted === "1" || product.isWeighted === true;

    if (errors.length > 0) {
      invalid.push({
        row,
        data: product,
        errors,
      });
    } else {
      const validProduct = {
        name: product.name.trim(),
        sku: product.sku.trim(),
        categoryId,
        supplierId: product.supplierId ? parseInt(product.supplierId) : undefined,
        purchasePrice,
        sellingPrice,
        stockQuantity,
        lowStockThreshold,
        isActive,
        isWeighted,
        taxRate,
      };

      // Remove undefined supplierId if not provided
      if (!validProduct.supplierId) {
        delete validProduct.supplierId;
      }

      valid.push(validProduct);
    }
  });

  return { valid, invalid };
};

module.exports = {
  parseCSV,
  jsonToCSV,
  validateProductImport,
};
