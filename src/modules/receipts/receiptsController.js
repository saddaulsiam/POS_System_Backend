import { PrismaClient } from "@prisma/client";
import { generateHTMLReceipt, generatePDFReceipt, generateThermalReceipt } from "../../utils/receiptGenerator.js";

const prisma = new PrismaClient();

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
  return {
    storeName: "POS System",
    storeAddress: "123 Business Avenue, Suite 100, City, State 12345",
    storePhone: "(555) 123-4567",
    storeEmail: "info@possystem.com",
    taxId: "TAX-123456789",
    returnPolicy: "Items may be returned within 30 days with receipt. Store credit only for items without receipt.",
  };
}

async function getSaleData(saleId) {
  const sale = await prisma.sale.findUnique({
    where: { id: parseInt(saleId) },
    include: {
      saleItems: { include: { product: true, productVariant: true } },
      customer: true,
      employee: { select: { id: true, name: true, username: true } },
      paymentSplits: true,
    },
  });
  if (!sale) throw new Error("Sale not found");
  return sale;
}

export const getPDFReceipt = async (req, res) => {
  try {
    const { saleId } = req.params;
    const saleData = await getSaleData(saleId);
    const settings = await getStoreSettings();
    const pdfDoc = generatePDFReceipt(saleData, settings);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"receipt_${saleId}.pdf\"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("Error generating PDF receipt:", error);
    res.status(500).json({ error: "Failed to generate PDF receipt", details: error.message });
  }
};

export const getHTMLReceipt = async (req, res) => {
  try {
    const { saleId } = req.params;
    const saleData = await getSaleData(saleId);
    const settings = await getStoreSettings();
    const htmlContent = generateHTMLReceipt(saleData, settings);
    res.setHeader("Content-Type", "text/html");
    res.send(htmlContent);
  } catch (error) {
    console.error("Error generating HTML receipt:", error);
    res.status(500).json({ error: "Failed to generate HTML receipt", details: error.message });
  }
};

export const getThermalReceipt = async (req, res) => {
  try {
    const { saleId } = req.params;
    const saleData = await getSaleData(saleId);
    const settings = await getStoreSettings();
    const thermalContent = generateThermalReceipt(saleData, settings);
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename=\"thermal_receipt_${saleId}.txt\"`);
    res.send(thermalContent);
  } catch (error) {
    console.error("Error generating thermal receipt:", error);
    res.status(500).json({ error: "Failed to generate thermal receipt", details: error.message });
  }
};

export const resendReceipt = async (req, res) => {
  try {
    const { saleId } = req.params;
    const { includePDF } = req.body;
    const saleData = await getSaleData(saleId);
    if (!saleData.customer || !saleData.customer.email) {
      return res.status(400).json({ error: "No customer email found for this sale" });
    }
    const settings = await getStoreSettings();
    const htmlContent = generateHTMLReceipt(saleData, settings);
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
      res.json({ message: "Receipt resent successfully", messageId: result.messageId, previewUrl: result.previewUrl });
    } else {
      res.status(500).json({ error: "Failed to resend receipt", details: result.error });
    }
  } catch (error) {
    console.error("Error resending receipt:", error);
    res.status(500).json({ error: "Failed to resend receipt", details: error.message });
  }
};

export const getReceiptPreview = async (req, res) => {
  try {
    const { saleId } = req.params;
    const saleData = await getSaleData(saleId);
    const settings = await getStoreSettings();
    res.json({ sale: saleData, settings });
  } catch (error) {
    console.error("Error getting receipt preview:", error);
    res.status(500).json({ error: "Failed to get receipt preview", details: error.message });
  }
};

export const printThermalReceipt = async (req, res) => {
  try {
    const { saleId, printerName } = req.body;
    if (!saleId) {
      return res.status(400).json({ error: "Sale ID is required" });
    }
    const saleData = await getSaleData(saleId);
    const settings = await getStoreSettings();
    const thermalContent = generateThermalReceipt(saleData, settings);
    res.json({
      message: "Thermal print initiated (mock)",
      content: thermalContent,
      note: "Actual printer integration requires additional setup",
    });
  } catch (error) {
    console.error("Error printing thermal receipt:", error);
    res.status(500).json({ error: "Failed to print thermal receipt", details: error.message });
  }
};
