import { generateHTMLReceipt, generatePDFReceipt, generateThermalReceipt } from "../../utils/receiptGenerator.js";
import { sendError, sendSuccess } from "../../utils/response.js";
import * as receiptsService from "./receiptsService.js";

export const getPDFReceipt = async (req, res) => {
  try {
    const { saleId } = req.params;
    const storeId = req.user.storeId;
    const saleData = await receiptsService.getSaleData(saleId, storeId);
    const settings = await receiptsService.getStoreSettings(storeId);
    const pdfDoc = generatePDFReceipt(saleData, settings);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"receipt_${saleId}.pdf\"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    console.error("Error generating PDF receipt:", error);
    sendError(res, 500, "Failed to generate PDF receipt", error.message);
  }
};

export const getHTMLReceipt = async (req, res) => {
  try {
    const { saleId } = req.params;
    const storeId = req.user.storeId;
    const saleData = await receiptsService.getSaleData(saleId, storeId);
    const settings = await receiptsService.getStoreSettings(storeId);
    const htmlContent = generateHTMLReceipt(saleData, settings);
    res.setHeader("Content-Type", "text/html");
    res.send(htmlContent);
  } catch (error) {
    console.error("Error generating HTML receipt:", error);
    sendError(res, 500, "Failed to generate HTML receipt", error.message);
  }
};

export const getThermalReceipt = async (req, res) => {
  try {
    const { saleId } = req.params;
    const storeId = req.user.storeId;
    const saleData = await receiptsService.getSaleData(saleId, storeId);
    const settings = await receiptsService.getStoreSettings(storeId);
    const thermalContent = generateThermalReceipt(saleData, settings);
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename=\"thermal_receipt_${saleId}.txt\"`);
    res.send(thermalContent);
  } catch (error) {
    console.error("Error generating thermal receipt:", error);
    sendError(res, 500, "Failed to generate thermal receipt", error.message);
  }
};

export const resendReceipt = async (req, res) => {
  try {
    const { saleId } = req.params;
    const { includePDF } = req.body;
    const storeId = req.user.storeId;
    const saleData = await receiptsService.getSaleData(saleId, storeId);
    if (!saleData.customer || !saleData.customer.email) {
      return sendError(res, 400, "No customer email found for this sale");
    }
    const settings = await receiptsService.getStoreSettings(storeId);
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
      sendSuccess(res, {
        message: "Receipt resent successfully",
        messageId: result.messageId,
        previewUrl: result.previewUrl,
      });
    } else {
      sendError(res, 500, "Failed to resend receipt", result.error);
    }
  } catch (error) {
    console.error("Error resending receipt:", error);
    sendError(res, 500, "Failed to resend receipt", error.message);
  }
};

export const getReceiptPreview = async (req, res) => {
  try {
    const { saleId } = req.params;
    const storeId = req.user.storeId;
    const saleData = await receiptsService.getSaleData(saleId, storeId);
    const settings = await receiptsService.getStoreSettings(storeId);
    sendSuccess(res, { sale: saleData, settings });
  } catch (error) {
    console.error("Error getting receipt preview:", error);
    sendError(res, 500, "Failed to get receipt preview", error.message);
  }
};

export const printThermalReceipt = async (req, res) => {
  try {
    const { saleId, printerName } = req.body;
    if (!saleId) {
      return sendError(res, 400, "Sale ID is required");
    }
    const storeId = req.user.storeId;
    const saleData = await receiptsService.getSaleData(saleId, storeId);
    const settings = await receiptsService.getStoreSettings(storeId);
    const thermalContent = generateThermalReceipt(saleData, settings);
    sendSuccess(res, {
      message: "Thermal print initiated (mock)",
      content: thermalContent,
      note: "Actual printer integration requires additional setup",
    });
  } catch (error) {
    console.error("Error printing thermal receipt:", error);
    sendError(res, 500, "Failed to print thermal receipt", error.message);
  }
};
