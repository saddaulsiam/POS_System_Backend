const bwipjs = require("bwip-js");

/**
 * Generate a unique barcode for a product
 * @param {string} sku - Product SKU
 * @param {number} id - Product ID
 * @returns {string} Generated barcode
 */
const generateBarcode = (sku, id) => {
  // Format: SKU + ID padded to 6 digits
  // Example: ABC123000001
  const paddedId = id.toString().padStart(6, "0");
  return `${sku.toUpperCase().replace(/[^A-Z0-9]/g, "")}${paddedId}`;
};

/**
 * Generate barcode image as PNG buffer
 * @param {string} barcodeText - The barcode text to encode
 * @param {Object} options - Barcode generation options
 * @returns {Promise<Buffer>} PNG image buffer
 */
const generateBarcodeImage = async (barcodeText, options = {}) => {
  try {
    const defaultOptions = {
      bcid: "code128", // Barcode type
      text: barcodeText, // Text to encode
      scale: 3, // 3x scaling factor
      height: 10, // Bar height, in millimeters
      includetext: true, // Show human-readable text
      textxalign: "center", // Center the text
    };

    const png = await bwipjs.toBuffer({
      ...defaultOptions,
      ...options,
    });

    return png;
  } catch (error) {
    throw new Error(`Barcode generation failed: ${error.message}`);
  }
};

/**
 * Validate barcode format
 * @param {string} barcode - Barcode to validate
 * @returns {boolean} Is valid
 */
const validateBarcode = (barcode) => {
  // Basic validation: alphanumeric, minimum 6 characters
  return /^[A-Z0-9]{6,}$/.test(barcode);
};

module.exports = {
  generateBarcode,
  generateBarcodeImage,
  validateBarcode,
};
