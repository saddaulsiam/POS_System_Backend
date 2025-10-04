const PDFDocument = require("pdfkit");

/**
 * Generate a PDF receipt for a sale
 * @param {Object} saleData - Complete sale data with items, customer, employee
 * @param {Object} settings - Store settings (name, address, etc.)
 * @returns {PDFDocument} PDF document stream
 */
function generatePDFReceipt(saleData, settings = {}) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  const storeSettings = {
    name: settings.storeName || "POS System",
    address: settings.storeAddress || "123 Main St, City, Country",
    phone: settings.storePhone || "(123) 456-7890",
    email: settings.storeEmail || "info@possystem.com",
    taxId: settings.taxId || "TAX-123456",
    ...settings,
  };

  // Header
  doc.fontSize(20).font("Helvetica-Bold").text(storeSettings.name, { align: "center" });
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(storeSettings.address, { align: "center" })
    .text(`Phone: ${storeSettings.phone} | Email: ${storeSettings.email}`, { align: "center" })
    .text(`Tax ID: ${storeSettings.taxId}`, { align: "center" });

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // Receipt Info
  doc.fontSize(12).font("Helvetica-Bold").text("SALES RECEIPT", { align: "center" });
  doc.moveDown(0.5);

  const receiptDate = new Date(saleData.createdAt);
  doc
    .fontSize(9)
    .font("Helvetica")
    .text(`Receipt #: ${saleData.id}`, 50, doc.y)
    .text(`Date: ${receiptDate.toLocaleDateString()} ${receiptDate.toLocaleTimeString()}`, { align: "right" });

  if (saleData.employee) {
    doc.text(`Cashier: ${saleData.employee.firstName} ${saleData.employee.lastName}`, 50, doc.y);
  }

  if (saleData.customer) {
    doc.text(`Customer: ${saleData.customer.firstName} ${saleData.customer.lastName}`, 50, doc.y);
    if (saleData.customer.phone) {
      doc.text(`Phone: ${saleData.customer.phone}`, 50, doc.y);
    }
  }

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // Items Header
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Item", 50, doc.y);
  doc.text("Qty", 300, doc.y);
  doc.text("Price", 370, doc.y);
  doc.text("Total", 480, doc.y, { align: "right" });

  doc.moveDown(0.3);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  // Items
  doc.font("Helvetica");
  saleData.items.forEach((item) => {
    const itemName = item.productVariant ? `${item.product.name} - ${item.productVariant.name}` : item.product.name;

    doc.text(itemName, 50, doc.y, { width: 240 });
    const itemY = doc.y - 12; // Adjust to align with item name
    doc.text(item.quantity.toString(), 300, itemY);
    doc.text(`$${item.unitPrice.toFixed(2)}`, 370, itemY);
    doc.text(`$${item.total.toFixed(2)}`, 480, itemY, { align: "right" });
    doc.moveDown(0.5);
  });

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // Totals
  const rightAlign = 480;
  doc.fontSize(10);

  doc.text("Subtotal:", 400, doc.y);
  doc.text(`$${saleData.subtotal.toFixed(2)}`, rightAlign, doc.y, { align: "right" });
  doc.moveDown(0.3);

  if (saleData.discountAmount > 0) {
    doc.text("Discount:", 400, doc.y);
    doc.text(`-$${saleData.discountAmount.toFixed(2)}`, rightAlign, doc.y, { align: "right" });
    if (saleData.discountReason) {
      doc.fontSize(8).text(`(${saleData.discountReason})`, 400, doc.y);
      doc.fontSize(10);
    }
    doc.moveDown(0.3);
  }

  doc.text("Tax:", 400, doc.y);
  doc.text(`$${saleData.taxAmount.toFixed(2)}`, rightAlign, doc.y, { align: "right" });
  doc.moveDown(0.3);

  doc.fontSize(12).font("Helvetica-Bold");
  doc.text("TOTAL:", 400, doc.y);
  doc.text(`$${saleData.finalAmount.toFixed(2)}`, rightAlign, doc.y, { align: "right" });
  doc.moveDown();

  // Payment Info
  doc.fontSize(9).font("Helvetica");
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  if (saleData.paymentSplits && saleData.paymentSplits.length > 0) {
    doc.text("Payment Details:", 50, doc.y);
    doc.moveDown(0.3);
    saleData.paymentSplits.forEach((split) => {
      doc.text(`${split.paymentMethod}:`, 70, doc.y);
      doc.text(`$${split.amount.toFixed(2)}`, rightAlign, doc.y, { align: "right" });
      doc.moveDown(0.3);
    });
  } else {
    doc.text(`Payment Method: ${saleData.paymentMethod}`, 50, doc.y);
    doc.text(`Amount Paid: $${saleData.finalAmount.toFixed(2)}`, rightAlign, doc.y, { align: "right" });
    doc.moveDown(0.3);
  }

  if (saleData.paymentStatus === "COMPLETED") {
    doc.text("Payment Status: PAID IN FULL", 50, doc.y, { align: "center" });
  }

  // Loyalty Points
  if (saleData.pointsEarned && saleData.pointsEarned > 0) {
    doc.moveDown();
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text(`Loyalty Points Earned: ${saleData.pointsEarned} pts`, { align: "center" });
    doc.font("Helvetica");
  }

  // Footer
  doc.moveDown(2);
  doc
    .fontSize(8)
    .font("Helvetica-Oblique")
    .text("Thank you for your business!", { align: "center" })
    .text("Please keep this receipt for your records", { align: "center" });

  if (settings.returnPolicy) {
    doc.moveDown(0.5);
    doc.fontSize(7).text(settings.returnPolicy, { align: "center", width: 400 });
  }

  return doc;
}

/**
 * Generate thermal receipt (80mm format) for direct printing
 * @param {Object} saleData - Complete sale data
 * @param {Object} settings - Store settings
 * @returns {string} ESC/POS formatted text
 */
function generateThermalReceipt(saleData, settings = {}) {
  const width = 48; // Characters per line for 80mm thermal printer
  const ESC = "\x1B";
  const GS = "\x1D";

  let receipt = "";

  // Initialize printer
  receipt += `${ESC}@`; // Initialize
  receipt += `${ESC}a${String.fromCharCode(1)}`; // Center align

  // Store header
  const storeName = settings.storeName || "POS System";
  receipt += `${ESC}!${String.fromCharCode(0x30)}`; // Double width + height
  receipt += `${storeName}\n`;
  receipt += `${ESC}!${String.fromCharCode(0x00)}`; // Normal size

  const address = settings.storeAddress || "123 Main St, City";
  const phone = settings.storePhone || "(123) 456-7890";
  receipt += `${address}\n`;
  receipt += `Phone: ${phone}\n`;

  if (settings.taxId) {
    receipt += `Tax ID: ${settings.taxId}\n`;
  }

  receipt += center("=".repeat(width), width) + "\n";

  // Receipt info
  receipt += `${ESC}a${String.fromCharCode(0)}`; // Left align
  receipt += `Receipt #: ${saleData.id}\n`;

  const receiptDate = new Date(saleData.createdAt);
  receipt += `Date: ${receiptDate.toLocaleDateString()}\n`;
  receipt += `Time: ${receiptDate.toLocaleTimeString()}\n`;

  if (saleData.employee) {
    receipt += `Cashier: ${saleData.employee.firstName} ${saleData.employee.lastName}\n`;
  }

  if (saleData.customer) {
    receipt += `Customer: ${saleData.customer.firstName} ${saleData.customer.lastName}\n`;
  }

  receipt += "-".repeat(width) + "\n";

  // Items
  receipt += `${ESC}!${String.fromCharCode(0x10)}`; // Emphasized
  receipt += padRight("Item", 24) + padRight("Qty", 8) + padLeft("Total", 16) + "\n";
  receipt += `${ESC}!${String.fromCharCode(0x00)}`; // Normal
  receipt += "-".repeat(width) + "\n";

  saleData.items.forEach((item) => {
    const itemName = item.productVariant ? `${item.product.name}-${item.productVariant.name}` : item.product.name;

    // Item name (may wrap)
    receipt += truncate(itemName, width) + "\n";

    // Quantity and price on same line
    const qtyStr = `${item.quantity} x $${item.unitPrice.toFixed(2)}`;
    const totalStr = `$${item.total.toFixed(2)}`;
    receipt += padRight(qtyStr, width - totalStr.length) + totalStr + "\n";
  });

  receipt += "=".repeat(width) + "\n";

  // Totals
  receipt += `${ESC}!${String.fromCharCode(0x00)}`; // Normal
  receipt += formatLine("Subtotal:", `$${saleData.subtotal.toFixed(2)}`, width) + "\n";

  if (saleData.discountAmount > 0) {
    receipt += formatLine("Discount:", `-$${saleData.discountAmount.toFixed(2)}`, width) + "\n";
  }

  receipt += formatLine("Tax:", `$${saleData.taxAmount.toFixed(2)}`, width) + "\n";
  receipt += "-".repeat(width) + "\n";

  receipt += `${ESC}!${String.fromCharCode(0x30)}`; // Double width + height
  receipt += formatLine("TOTAL:", `$${saleData.finalAmount.toFixed(2)}`, width / 2) + "\n";
  receipt += `${ESC}!${String.fromCharCode(0x00)}`; // Normal
  receipt += "=".repeat(width) + "\n";

  // Payment
  if (saleData.paymentSplits && saleData.paymentSplits.length > 0) {
    receipt += "Payment:\n";
    saleData.paymentSplits.forEach((split) => {
      receipt += formatLine(`  ${split.paymentMethod}`, `$${split.amount.toFixed(2)}`, width) + "\n";
    });
  } else {
    receipt += formatLine(`Payment (${saleData.paymentMethod}):`, `$${saleData.finalAmount.toFixed(2)}`, width) + "\n";
  }

  // Loyalty points
  if (saleData.pointsEarned && saleData.pointsEarned > 0) {
    receipt += "-".repeat(width) + "\n";
    receipt += `${ESC}a${String.fromCharCode(1)}`; // Center
    receipt += `Points Earned: ${saleData.pointsEarned}\n`;
    receipt += `${ESC}a${String.fromCharCode(0)}`; // Left
  }

  // Footer
  receipt += "\n";
  receipt += `${ESC}a${String.fromCharCode(1)}`; // Center
  receipt += "Thank you for your business!\n";
  receipt += "Please come again\n\n";

  // Cut paper
  receipt += `${GS}V${String.fromCharCode(66)}${String.fromCharCode(0)}`;

  return receipt;
}

// Helper functions for thermal receipt
function padRight(str, length) {
  return str.substring(0, length).padEnd(length, " ");
}

function padLeft(str, length) {
  return str.substring(0, length).padStart(length, " ");
}

function center(str, width) {
  const padding = Math.floor((width - str.length) / 2);
  return " ".repeat(padding) + str;
}

function formatLine(label, value, width) {
  const maxLabelLength = width - value.length;
  return padRight(label, maxLabelLength) + value;
}

function truncate(str, length) {
  return str.length > length ? str.substring(0, length - 3) + "..." : str;
}

/**
 * Generate HTML receipt for email
 * @param {Object} saleData - Complete sale data
 * @param {Object} settings - Store settings
 * @returns {string} HTML content
 */
function generateHTMLReceipt(saleData, settings = {}) {
  const storeSettings = {
    name: settings.storeName || "POS System",
    address: settings.storeAddress || "123 Main St, City, Country",
    phone: settings.storePhone || "(123) 456-7890",
    email: settings.storeEmail || "info@possystem.com",
    ...settings,
  };

  const receiptDate = new Date(saleData.createdAt);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt #${saleData.id}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    .store-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
    .store-info { font-size: 12px; color: #666; }
    .receipt-info { margin-bottom: 20px; font-size: 14px; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .items-table th { background: #f5f5f5; padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    .items-table td { padding: 8px; border-bottom: 1px solid #eee; }
    .totals { text-align: right; margin-bottom: 20px; }
    .totals-row { display: flex; justify-content: flex-end; margin: 5px 0; }
    .totals-label { margin-right: 20px; min-width: 100px; }
    .total-final { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
    .payment-info { background: #f9f9f9; padding: 15px; margin-bottom: 20px; }
    .footer { text-align: center; font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
    .loyalty-points { background: #e8f5e9; padding: 10px; text-align: center; margin: 10px 0; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="store-name">${storeSettings.name}</div>
    <div class="store-info">
      ${storeSettings.address}<br>
      Phone: ${storeSettings.phone} | Email: ${storeSettings.email}
      ${storeSettings.taxId ? `<br>Tax ID: ${storeSettings.taxId}` : ""}
    </div>
  </div>

  <div class="receipt-info">
    <strong>Receipt #${saleData.id}</strong><br>
    Date: ${receiptDate.toLocaleDateString()} ${receiptDate.toLocaleTimeString()}<br>
    ${saleData.employee ? `Cashier: ${saleData.employee.firstName} ${saleData.employee.lastName}<br>` : ""}
    ${saleData.customer ? `Customer: ${saleData.customer.firstName} ${saleData.customer.lastName}<br>` : ""}
  </div>

  <table class="items-table">
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align: center;">Qty</th>
        <th style="text-align: right;">Price</th>
        <th style="text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${saleData.items
        .map((item) => {
          const itemName = item.productVariant
            ? `${item.product.name} - ${item.productVariant.name}`
            : item.product.name;
          return `
        <tr>
          <td>${itemName}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">$${item.unitPrice.toFixed(2)}</td>
          <td style="text-align: right;">$${item.total.toFixed(2)}</td>
        </tr>
        `;
        })
        .join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <div class="totals-label">Subtotal:</div>
      <div>$${saleData.subtotal.toFixed(2)}</div>
    </div>
    ${
      saleData.discountAmount > 0
        ? `
    <div class="totals-row">
      <div class="totals-label">Discount:</div>
      <div>-$${saleData.discountAmount.toFixed(2)}</div>
    </div>
    ${saleData.discountReason ? `<div style="font-size: 12px; color: #666;">(${saleData.discountReason})</div>` : ""}
    `
        : ""
    }
    <div class="totals-row">
      <div class="totals-label">Tax:</div>
      <div>$${saleData.taxAmount.toFixed(2)}</div>
    </div>
    <div class="totals-row total-final">
      <div class="totals-label">TOTAL:</div>
      <div>$${saleData.finalAmount.toFixed(2)}</div>
    </div>
  </div>

  <div class="payment-info">
    <strong>Payment Details:</strong><br>
    ${
      saleData.paymentSplits && saleData.paymentSplits.length > 0
        ? saleData.paymentSplits.map((split) => `${split.paymentMethod}: $${split.amount.toFixed(2)}`).join("<br>")
        : `${saleData.paymentMethod}: $${saleData.finalAmount.toFixed(2)}`
    }
    <br>
    Status: ${saleData.paymentStatus === "COMPLETED" ? "PAID IN FULL" : saleData.paymentStatus}
  </div>

  ${
    saleData.pointsEarned && saleData.pointsEarned > 0
      ? `
  <div class="loyalty-points">
    🎉 You earned <strong>${saleData.pointsEarned} loyalty points</strong> with this purchase!
  </div>
  `
      : ""
  }

  <div class="footer">
    <p><strong>Thank you for your business!</strong></p>
    <p>Please keep this receipt for your records</p>
    ${settings.returnPolicy ? `<p style="font-size: 11px; margin-top: 10px;">${settings.returnPolicy}</p>` : ""}
  </div>
</body>
</html>
  `.trim();
}

module.exports = {
  generatePDFReceipt,
  generateThermalReceipt,
  generateHTMLReceipt,
};
