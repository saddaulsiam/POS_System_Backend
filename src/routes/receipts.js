const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { authenticateToken } = require("../middleware/auth");
const { generatePDFReceipt, generateThermalReceipt, generateHTMLReceipt } = require("../utils/receiptGenerator");
const emailService = require("../utils/emailService");

const prisma = new PrismaClient();

/**
 * Get store settings from database
 */
async function getStoreSettings() {
  const settings = await prisma.pOSSettings.findFirst();

  if (settings) {
    return {
      storeName: settings.storeName,
      storeAddress: settings.storeAddress,
      storePhone: settings.storePhone,
      storeEmail: settings.storeEmail,
      taxId: settings.taxId,
      returnPolicy: settings.returnPolicy,
      receiptFooterText: settings.receiptFooterText,
      taxRate: settings.taxRate,
      currencyCode: settings.currencyCode,
      currencySymbol: settings.currencySymbol,
      currencyPosition: settings.currencyPosition,
    };
  }

  // Fallback to defaults if no settings found
  return {
    storeName: "POS System",
    storeAddress: "123 Business Avenue, Suite 100, City, State 12345",
    storePhone: "(555) 123-4567",
    storeEmail: "info@possystem.com",
    taxId: "TAX-123456789",
    returnPolicy: "Items may be returned within 30 days with receipt. Store credit only for items without receipt.",
  };
}

/**
 * Fetch complete sale data with all relations
 */
async function getSaleData(saleId) {
  const sale = await prisma.sale.findUnique({
    where: { id: parseInt(saleId) },
    include: {
      saleItems: {
        include: {
          product: true,
          productVariant: true,
        },
      },
      customer: true,
      employee: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
      paymentSplits: true,
    },
  });

  if (!sale) {
    throw new Error("Sale not found");
  }

  return sale;
}

/**
 * POST /api/receipts/send-email
 * Send receipt to customer via email
 */
router.post("/send-email", authenticateToken, async (req, res) => {
  try {
    const { saleId, customerEmail, customerName, includePDF } = req.body;

    if (!saleId || !customerEmail) {
      return res.status(400).json({
        error: "Sale ID and customer email are required",
      });
    }

    // Get sale data
    const saleData = await getSaleData(saleId);
    const settings = await getStoreSettings();

    // Generate HTML receipt
    const htmlContent = generateHTMLReceipt(saleData, settings);

    // Send email
    let result;
    if (includePDF) {
      // Generate PDF and attach it
      const pdfDoc = generatePDFReceipt(saleData, settings);
      const chunks = [];

      pdfDoc.on("data", (chunk) => chunks.push(chunk));

      await new Promise((resolve, reject) => {
        pdfDoc.on("end", resolve);
        pdfDoc.on("error", reject);
        pdfDoc.end();
      });

      const pdfBuffer = Buffer.concat(chunks);

      result = await emailService.sendReceiptWithPDF(
        customerEmail,
        customerName || `${saleData.customer?.firstName} ${saleData.customer?.lastName}` || "Customer",
        htmlContent,
        pdfBuffer,
        saleData.id
      );
    } else {
      result = await emailService.sendReceipt(
        customerEmail,
        customerName || `${saleData.customer?.firstName} ${saleData.customer?.lastName}` || "Customer",
        htmlContent
      );
    }

    if (result.success) {
      res.json({
        message: "Receipt sent successfully",
        messageId: result.messageId,
        previewUrl: result.previewUrl, // For development mode
      });
    } else {
      res.status(500).json({
        error: "Failed to send email",
        details: result.error,
      });
    }
  } catch (error) {
    console.error("Error sending receipt email:", error);
    res.status(500).json({
      error: "Failed to send receipt email",
      details: error.message,
    });
  }
});

/**
 * GET /api/receipts/:saleId/pdf
 * Download PDF receipt
 */
router.get("/:saleId/pdf", authenticateToken, async (req, res) => {
  try {
    const { saleId } = req.params;

    // Get sale data
    const saleData = await getSaleData(saleId);
    const settings = await getStoreSettings();

    // Generate PDF
    const pdfDoc = generatePDFReceipt(saleData, settings);

    // Set headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receipt_${saleId}.pdf"`);

    // Pipe PDF to response
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("Error generating PDF receipt:", error);
    res.status(500).json({
      error: "Failed to generate PDF receipt",
      details: error.message,
    });
  }
});

/**
 * GET /api/receipts/:saleId/html
 * Get HTML receipt (for preview or printing)
 */
router.get("/:saleId/html", authenticateToken, async (req, res) => {
  try {
    const { saleId } = req.params;

    // Get sale data
    const saleData = await getSaleData(saleId);
    const settings = await getStoreSettings();

    // Generate HTML
    const htmlContent = generateHTMLReceipt(saleData, settings);

    res.setHeader("Content-Type", "text/html");
    res.send(htmlContent);
  } catch (error) {
    console.error("Error generating HTML receipt:", error);
    res.status(500).json({
      error: "Failed to generate HTML receipt",
      details: error.message,
    });
  }
});

/**
 * GET /api/receipts/:saleId/thermal
 * Get thermal receipt format (for direct printer output)
 */
router.get("/:saleId/thermal", authenticateToken, async (req, res) => {
  try {
    const { saleId } = req.params;

    // Get sale data
    const saleData = await getSaleData(saleId);
    const settings = await getStoreSettings();

    // Generate thermal receipt
    const thermalContent = generateThermalReceipt(saleData, settings);

    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="thermal_receipt_${saleId}.txt"`);
    res.send(thermalContent);
  } catch (error) {
    console.error("Error generating thermal receipt:", error);
    res.status(500).json({
      error: "Failed to generate thermal receipt",
      details: error.message,
    });
  }
});

/**
 * POST /api/receipts/resend/:saleId
 * Resend receipt to customer (uses email from sale customer record)
 */
router.post("/resend/:saleId", authenticateToken, async (req, res) => {
  try {
    const { saleId } = req.params;
    const { includePDF } = req.body;

    // Get sale data
    const saleData = await getSaleData(saleId);

    if (!saleData.customer || !saleData.customer.email) {
      return res.status(400).json({
        error: "No customer email found for this sale",
      });
    }

    const settings = await getStoreSettings();
    const htmlContent = generateHTMLReceipt(saleData, settings);

    // Send email
    let result;
    if (includePDF) {
      const pdfDoc = generatePDFReceipt(saleData, settings);
      const chunks = [];

      pdfDoc.on("data", (chunk) => chunks.push(chunk));

      await new Promise((resolve, reject) => {
        pdfDoc.on("end", resolve);
        pdfDoc.on("error", reject);
        pdfDoc.end();
      });

      const pdfBuffer = Buffer.concat(chunks);

      result = await emailService.sendReceiptWithPDF(
        saleData.customer.email,
        `${saleData.customer.firstName} ${saleData.customer.lastName}`,
        htmlContent,
        pdfBuffer,
        saleData.id
      );
    } else {
      result = await emailService.sendReceipt(
        saleData.customer.email,
        `${saleData.customer.firstName} ${saleData.customer.lastName}`,
        htmlContent
      );
    }

    if (result.success) {
      res.json({
        message: "Receipt resent successfully",
        messageId: result.messageId,
        previewUrl: result.previewUrl,
      });
    } else {
      res.status(500).json({
        error: "Failed to resend receipt",
        details: result.error,
      });
    }
  } catch (error) {
    console.error("Error resending receipt:", error);
    res.status(500).json({
      error: "Failed to resend receipt",
      details: error.message,
    });
  }
});

/**
 * GET /api/receipts/:saleId/preview
 * Get receipt data for frontend preview (JSON format)
 */
router.get("/:saleId/preview", authenticateToken, async (req, res) => {
  try {
    const { saleId } = req.params;

    const saleData = await getSaleData(saleId);
    const settings = await getStoreSettings();

    res.json({
      sale: saleData,
      settings: settings,
    });
  } catch (error) {
    console.error("Error getting receipt preview:", error);
    res.status(500).json({
      error: "Failed to get receipt preview",
      details: error.message,
    });
  }
});

/**
 * POST /api/receipts/print-thermal
 * Send thermal receipt directly to printer
 * Note: This requires additional setup with printer drivers/libraries
 */
router.post("/print-thermal", authenticateToken, async (req, res) => {
  try {
    const { saleId, printerName } = req.body;

    if (!saleId) {
      return res.status(400).json({ error: "Sale ID is required" });
    }

    const saleData = await getSaleData(saleId);
    const settings = await getStoreSettings();
    const thermalContent = generateThermalReceipt(saleData, settings);

    // TODO: Implement actual printer integration
    // This would require platform-specific printer libraries like:
    // - node-printer for Windows/Mac/Linux
    // - escpos for ESC/POS thermal printers
    // - electron-pos-printer for Electron apps

    // For now, return the thermal content
    res.json({
      message: "Thermal print initiated (mock)",
      content: thermalContent,
      note: "Actual printer integration requires additional setup",
    });
  } catch (error) {
    console.error("Error printing thermal receipt:", error);
    res.status(500).json({
      error: "Failed to print thermal receipt",
      details: error.message,
    });
  }
});

module.exports = router;
