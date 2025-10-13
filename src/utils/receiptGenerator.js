const PDFDocument = require("pdfkit");

/**
 * Helper to get a valid name from firstName/lastName or name field
 */
function getValidName(obj) {
  if (!obj) return "N/A";
  let first = obj.firstName && obj.firstName !== "undefined" ? obj.firstName.trim() : "";
  let last = obj.lastName && obj.lastName !== "undefined" ? obj.lastName.trim() : "";
  let full = "";
  if (first && last) {
    full = `${first} ${last}`.trim();
  } else if (first) {
    full = first;
  } else if (last) {
    full = last;
  }
  if (!full || full.toLowerCase().includes("undefined")) {
    if (obj.name && obj.name !== "undefined" && obj.name.trim() !== "") {
      full = obj.name.trim();
    }
  }
  if (!full || full.toLowerCase().includes("undefined") || full === "") {
    return "N/A";
  }
  return full;
}

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
    taxId: settings.taxId || "TAX-123456",
    ...settings,
  };

  // Header
  doc.fontSize(20).font("Helvetica-Bold").text(storeSettings.name, { align: "center" });
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(storeSettings.address, { align: "center" })
    .text(`Phone: ${storeSettings.phone}`, { align: "center" })
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

  let cashierName = "N/A";
  if (saleData.employee) {
    cashierName = getValidName(saleData.employee);
  }
  doc.text(`Cashier: ${cashierName}`, 50, doc.y);

  let customerName = "N/A";
  if (saleData.customer) {
    customerName = getValidName(saleData.customer);
    doc.text(`Customer: ${customerName}`, 50, doc.y);
    if (saleData.customer.phone) {
      doc.text(`Phone: ${saleData.customer.phone}`, 50, doc.y);
    }
  }

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  // ...existing code...
  return doc;
}

/**
 * Generate thermal receipt (80mm format) for direct printing
 * @param {Object} saleData - Complete sale data
 * @param {Object} settings - Store settings
 * @returns {string} ESC/POS formatted text
 */
function generateThermalReceipt(saleData, settings = {}) {
  // Use dynamic currency symbol
  const currency = settings.currencySymbol || "$";
  const width = 48; // Characters per line for 80mm thermal printer
  const ESC = "\x1B";
  const GS = "\x1D";

  let receipt = "";

  // Store header (centered, no ESC codes)
  const storeName = settings.storeName || "POS System";
  receipt += center(storeName, width) + "\n";
  const address = settings.storeAddress || "123 Main St, City";
  receipt += center(address, width) + "\n";
  const phone = settings.storePhone || "(123) 456-7890";
  receipt += center(`Phone: ${phone}`, width) + "\n";
  if (settings.taxId) {
    receipt += center(`Tax ID: ${settings.taxId}`, width) + "\n";
  }
  receipt += "=".repeat(width) + "\n";

  // Receipt info (left aligned)
  const receiptDate = new Date(saleData.createdAt);
  receipt += `Receipt #: ${saleData.id}\n`;
  receipt += `Date: ${receiptDate.toLocaleDateString()}\n`;
  receipt += `Time: ${receiptDate.toLocaleTimeString()}\n`;

  // Cashier name fallback (always show)
  let cashierName = getValidName(saleData.employee);
  receipt += `Cashier: ${cashierName}\n`;

  // Customer name fallback (always show)
  let customerName = getValidName(saleData.customer);
  receipt += `Customer: ${customerName}\n`;

  receipt += "-".repeat(width) + "\n";

  // Items header
  receipt += padRight("Item", 24) + padRight("Qty", 8) + padLeft("Total", 16) + "\n";
  receipt += "-".repeat(width) + "\n";

  saleData.saleItems.forEach((item) => {
    const itemName = item.productVariant ? `${item.product.name}-${item.productVariant.name}` : item.product.name;
    // Item name (may wrap)
    let nameLines = [];
    let name = itemName;
    while (name.length > width) {
      nameLines.push(name.slice(0, width));
      name = name.slice(width);
    }
    if (name.length > 0) nameLines.push(name);
    nameLines.forEach((line, idx) => {
      receipt += truncate(line, width) + "\n";
    });

    // Quantity and price on same line, indented for clarity
    const qtyStr = `${item.quantity} x ${currency}${item.priceAtSale.toFixed(2)}`;
    const totalStr = `${currency}${item.subtotal.toFixed(2)}`;
    receipt += padRight("  " + qtyStr, width - totalStr.length) + totalStr + "\n";
  });

  // Add spacing before totals
  receipt += "\n" + "=".repeat(width) + "\n";

  // Totals section
  receipt += formatLine("Subtotal:", `${currency}${saleData.subtotal.toFixed(2)}`, width) + "\n";
  if (saleData.discountAmount > 0) {
    receipt += formatLine("Discount:", `-${currency}${saleData.discountAmount.toFixed(2)}`, width) + "\n";
  }
  receipt += formatLine("Tax:", `${currency}${saleData.taxAmount.toFixed(2)}`, width) + "\n";
  receipt += "-".repeat(width) + "\n";

  // Centered and bold TOTAL
  const totalLine = formatLine("TOTAL:", `${currency}${saleData.finalAmount.toFixed(2)}`, width / 2);
  receipt += center(totalLine, width) + "\n";
  receipt += "=".repeat(width) + "\n";

  // Payment
  if (saleData.paymentSplits && saleData.paymentSplits.length > 0) {
    receipt += "Payment:\n";
    saleData.paymentSplits.forEach((split) => {
      receipt += formatLine(`  ${split.paymentMethod}`, `${currency}${split.amount.toFixed(2)}`, width) + "\n";
    });
  } else {
    receipt +=
      formatLine(`Payment (${saleData.paymentMethod}):`, `${currency}${saleData.finalAmount.toFixed(2)}`, width) + "\n";
  }

  // Loyalty points
  if (saleData.pointsEarned && saleData.pointsEarned > 0) {
    receipt += "-".repeat(width) + "\n";
    receipt += center(`Points Earned: ${saleData.pointsEarned}`, width) + "\n";
  }

  // Footer
  receipt += "\n";
  if (settings.receiptFooterText) {
    receipt += center(settings.receiptFooterText, width) + "\n";
  } else {
    receipt += center("Thank you for your business!", width) + "\n";
  }

  if (settings.returnPolicy) {
    receipt += "\n";
    receipt += center("Return Policy:", width) + "\n";
    // Wrap return policy text for thermal printer
    const policyWords = settings.returnPolicy.split(" ");
    let policyLine = "";
    policyWords.forEach((word) => {
      if ((policyLine + word).length > width) {
        receipt += center(policyLine.trim(), width) + "\n";
        policyLine = word + " ";
      } else {
        policyLine += word + " ";
      }
    });
    if (policyLine.trim()) {
      receipt += center(policyLine.trim(), width) + "\n";
    }
  }

  receipt += "\n";

  // Cut paper
  receipt += `${GS}V${String.fromCharCode(66)}${String.fromCharCode(0)}`;

  return receipt;
}

// Helper functions for thermal receipt
function padRight(str, length) {
  if (length <= 0) return str;
  return str.length > length ? str.substring(0, length) : str.padEnd(length, " ");
}

function padLeft(str, length) {
  if (length <= 0) return str;
  return str.length > length ? str.substring(0, length) : str.padStart(length, " ");
}

function center(str, width) {
  if (width <= str.length) return str;
  const padding = Math.floor((width - str.length) / 2);
  return " ".repeat(padding) + str;
}

function formatLine(label, value, width) {
  const maxLabelLength = Math.max(0, width - value.length);
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
    ...settings,
  };

  const receiptDate = new Date(saleData.createdAt);

  let cashierName = getValidName(saleData.employee);
  let customerName = getValidName(saleData.customer);

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
  Phone: ${storeSettings.phone}
      ${storeSettings.taxId ? `<br>Tax ID: ${storeSettings.taxId}` : ""}
    </div>
  </div>

  <div class="receipt-info">
    <strong>Receipt #${saleData.id}</strong><br>
    Date: ${receiptDate.toLocaleDateString()} ${receiptDate.toLocaleTimeString()}<br>
    Cashier: ${cashierName}<br>
    Customer: ${customerName}<br>
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
      ${saleData.saleItems
        .map((item) => {
          const itemName = item.productVariant
            ? `${item.product.name} - ${item.productVariant.name}`
            : item.product.name;
          return `
        <tr>
          <td>${itemName}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right;">$${item.priceAtSale.toFixed(2)}</td>
          <td style="text-align: right;">$${item.subtotal.toFixed(2)}</td>
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
    <p><strong>${settings.receiptFooterText || "Thank you for your shopping!"}</strong></p>
    <p>Please keep this receipt for your records</p>
    ${
      settings.returnPolicy
        ? `<p style="font-size: 11px; margin-top: 10px;"><strong>Return Policy:</strong><br>${settings.returnPolicy}</p>`
        : ""
    }
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
