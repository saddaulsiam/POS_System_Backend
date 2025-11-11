import PDFDocument from "pdfkit";

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

function generatePDFReceipt(saleData, settings = {}) {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  const storeSettings = {
    name: settings.storeName || "POS System",
    address: settings.storeAddress || "123 Main St, City, Country",
    phone: settings.storePhone || "(123) 456-7890",
    taxId: settings.taxId || "TAX-123456",
    ...settings,
  };

  // Header - make store name responsive by shrinking font size to fit page width
  doc.font("Helvetica-Bold");
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  let titleSize = 20;
  // Reduce font size until the text fits or a minimum size is reached
  while (titleSize > 8) {
    doc.fontSize(titleSize);
    // widthOfString measures current font settings
    const w = doc.widthOfString(storeSettings.name);
    if (w <= usableWidth) break;
    titleSize -= 1;
  }
  doc.fontSize(titleSize).text(storeSettings.name, { align: "center" });
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(storeSettings.address, { align: "center" })
    .text(`Phone: ${storeSettings.phone}`, { align: "center" });
  if (storeSettings.taxId) {
    doc.text(`Tax ID: ${storeSettings.taxId}`, { align: "center" });
  }

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
  // Totals
  doc.moveDown();
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(`Subtotal: ${storeSettings.currencySymbol || "$"}${saleData.subtotal.toFixed(2)}`);
  if (saleData.loyaltyDiscount && saleData.loyaltyDiscount > 0) {
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(`Loyalty Discount: -${storeSettings.currencySymbol || "$"}${saleData.loyaltyDiscount.toFixed(2)}`);
  }
  if (saleData.offerDiscount && saleData.offerDiscount > 0) {
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(
        `Offer Discount${saleData.offerTitle ? ` (${saleData.offerTitle})` : ""}: -${
          storeSettings.currencySymbol || "$"
        }${saleData.offerDiscount.toFixed(2)}`
      );
  }
  if (saleData.discountAmount > 0) {
    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text(`Discount: -${storeSettings.currencySymbol || "$"}${saleData.discountAmount.toFixed(2)}`);
  }
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(`Tax: ${storeSettings.currencySymbol || "$"}${saleData.taxAmount.toFixed(2)}`);
  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .text(`TOTAL: ${storeSettings.currencySymbol || "$"}${saleData.finalAmount.toFixed(2)}`);

  // Payment section (same logic as thermal)
  doc.moveDown();
  let cashPayment = null;
  if (saleData.paymentSplits && saleData.paymentSplits.length > 0) {
    doc.fontSize(12).font("Helvetica-Bold").text("Payment:");
    saleData.paymentSplits.forEach((split) => {
      doc
        .fontSize(12)
        .font("Helvetica")
        .text(`${split.paymentMethod}: ${storeSettings.currencySymbol || "$"}${split.amount.toFixed(2)}`);
      if (split.paymentMethod === "CASH") cashPayment = split;
    });
  } else {
    if (saleData.paymentMethod === "CARD") {
      doc
        .fontSize(12)
        .font("Helvetica")
        .text(
          `${saleData.paymentMethod} PAID: ${storeSettings.currencySymbol || "$"}${saleData.finalAmount.toFixed(2)}`
        );
      if (saleData.paymentMethod === "CASH") cashPayment = { amount: saleData.finalAmount };
    }
  }
  if ((saleData.paymentMethod === "CASH" || cashPayment) && saleData.cashReceived != null) {
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`Cash Received: ${storeSettings.currencySymbol || "$"}${Number(saleData.cashReceived).toFixed(2)}`);
    if (saleData.changeGiven != null) {
      doc
        .fontSize(12)
        .font("Helvetica")
        .text(`Change Amount: ${storeSettings.currencySymbol || "$"}${Number(saleData.changeGiven).toFixed(2)}`);
    }
  }
  // ...existing code...
  return doc;
}

function generateThermalReceipt(saleData, settings = {}) {
  // Use dynamic currency symbol
  const currency = settings.currencySymbol || "$";
  const width = 48; // Characters per line for 80mm thermal printer
  const ESC = "\x1B";
  const GS = "\x1D";

  let receipt = "";

  // Store header (centered, no ESC codes)
  const storeName = settings.storeName || "POS System";
  const address = settings.storeAddress || "123 Main St, City";
  const phone = settings.storePhone || "(123) 456-7890";
  const taxId = settings.taxId;

  // Helper to wrap long strings into lines no longer than width
  function wrapText(str, maxLen) {
    if (!str) return [""];
    const words = String(str).split(/\s+/);
    const lines = [];
    let current = "";
    words.forEach((w) => {
      if ((current + " " + w).trim().length > maxLen) {
        if (current.trim().length > 0) lines.push(current.trim());
        // If single word longer than maxLen, hard-split
        if (w.length > maxLen) {
          let i = 0;
          while (i < w.length) {
            lines.push(w.substr(i, maxLen));
            i += maxLen;
          }
          current = "";
        } else {
          current = w;
        }
      } else {
        current = (current + " " + w).trim();
      }
    });
    if (current) lines.push(current.trim());
    return lines.length ? lines : [""];
  }

  // Center and append wrapped lines for header
  wrapText(storeName, width).forEach((ln) => (receipt += center(ln, width) + "\n"));
  wrapText(address, width).forEach((ln) => (receipt += center(ln, width) + "\n"));
  wrapText(`Phone: ${phone}`, width).forEach((ln) => (receipt += center(ln, width) + "\n"));
  if (taxId) wrapText(`Tax ID: ${taxId}`, width).forEach((ln) => (receipt += center(ln, width) + "\n"));
  receipt += "=".repeat(width) + "\n";

  // Receipt info (left aligned)
  const receiptDate = new Date(saleData.createdAt);
  receipt += `Receipt #: ${saleData.receiptId}\n`;
  receipt += `Date: ${receiptDate.toLocaleDateString()}\n`;
  receipt += `Time: ${receiptDate.toLocaleTimeString()}\n`;

  // Cashier name fallback (always show)
  let cashierName = getValidName(saleData.employee);
  receipt += `Cashier: ${cashierName}\n`;

  // Customer name fallback (always show)
  let customerName = getValidName(saleData.customer);
  receipt += `Customer: ${customerName}\n`;

  receipt += "-".repeat(width) + "\n";

  const nameWidth = 30;
  const qtyWidth = 10;
  const totalWidth = width - nameWidth - qtyWidth;

  // Items header
  receipt += padRight("Item", nameWidth) + padRight("Qty", qtyWidth) + padLeft("Total", totalWidth) + "\n";
  receipt += "-".repeat(width) + "\n";

  saleData.saleItems.forEach((item) => {
    const itemName = item.productVariant ? `${item.product.name} - ${item.productVariant.name}` : item.product.name;
    const nameStr = padRight(itemName, nameWidth);
    const qtyStr = padRight(`${item.priceAtSale.toFixed(2)} x ${item.quantity}`, qtyWidth);
    const totalStr = padLeft(`${currency}${item.subtotal.toFixed(2)}`, totalWidth);
    receipt += nameStr + qtyStr + totalStr + "\n";
  });

  // Add spacing before totals
  receipt += "\n" + "-".repeat(width) + "\n";

  // Totals section
  receipt += formatLine("Subtotal:", `${currency}${saleData.subtotal.toFixed(2)}`, width) + "\n";
  // Show loyalty discount as a separate line if present
  if (saleData.loyaltyDiscount && saleData.loyaltyDiscount > 0) {
    receipt += formatLine("Loyalty Discount:", `(-)${currency}${saleData.loyaltyDiscount.toFixed(2)}`, width) + "\n";
  }
  if (saleData.offerDiscount && saleData.offerDiscount > 0) {
    receipt +=
      formatLine(
        `Offer Discount${saleData.offerTitle ? ` (${saleData.offerTitle})` : ""}:`,
        `(-)${currency}${saleData.offerDiscount.toFixed(2)}`,
        width
      ) + "\n";
  }
  if (saleData.discountAmount > 0) {
    receipt += formatLine("Discount:", `-${currency}${saleData.discountAmount.toFixed(2)}`, width) + "\n";
  }
  receipt += formatLine("Tax:", `${currency}${saleData.taxAmount.toFixed(2)}`, width) + "\n";
  receipt += "-".repeat(width) + "\n";

  // Centered and bold TOTAL
  receipt += formatLine("TOTAL:", `${currency}${saleData.finalAmount.toFixed(2)}`, width) + "\n";
  receipt += "=".repeat(width) + "\n";

  // Payment
  let cashPayment = null;
  if (saleData.paymentSplits && saleData.paymentSplits.length > 0) {
    receipt += "Payment:\n";
    saleData.paymentSplits.forEach((split) => {
      receipt += formatLine(`${split.paymentMethod}`, `${currency}${split.amount.toFixed(2)}`, width) + "\n";
      if (split.paymentMethod === "CASH") cashPayment = split;
    });
  } else {
    if (saleData.paymentMethod === "CARD") {
      receipt +=
        formatLine(`${saleData.paymentMethod} PAID:`, `${currency}${saleData.finalAmount.toFixed(2)}`, width) + "\n";
      if (saleData.paymentMethod === "CASH") cashPayment = { amount: saleData.finalAmount };
    }
  }

  // Show cash received and change if payment is/was CASH
  if ((saleData.paymentMethod === "CASH" || cashPayment) && saleData.cashReceived != null) {
    receipt += formatLine("Cash Received:", `${currency}${Number(saleData.cashReceived).toFixed(2)}`, width) + "\n";
    if (saleData.changeGiven != null) {
      receipt += formatLine("Change Amount:", `${currency}${Number(saleData.changeGiven).toFixed(2)}`, width) + "\n";
    }
  }

  // Loyalty points
  if (saleData.pointsEarned && saleData.pointsEarned > 0) {
    receipt += "-".repeat(width) + "\n";
    receipt += center(`🎉 You earned ${saleData.pointsEarned} loyalty points!`, width) + "\n";
  }

  // Footer
  receipt += "\n";
  if (settings.receiptFooterText) {
    receipt += center(settings.receiptFooterText, width) + "\n";
  } else {
    receipt += center("Thank you for shopping with us!", width) + "\n";
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

  const currency = settings.currencySymbol || "$";
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt #${saleData.id}</title>
  <style>
    /* Responsive header and receipt styles */
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; margin: 0; padding: 10px; color: #222; }
    .store-header { text-align: center; max-width: 700px; margin: 0 auto 8px auto; word-wrap: break-word; white-space: normal; }
    .store-header .name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .store-header .meta { font-size: 12px; color: #444; }
    .receipt-info { margin: 12px 0; font-size: 13px; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .items-table th, .items-table td { padding: 6px 8px; border-bottom: 1px solid #eee; }
    .items-table th { text-align: left; font-weight: 600; }
    .totals { max-width: 420px; margin-left: auto; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .totals-label { color: #333; }
    .total-final { font-size: 16px; font-weight: 700; }
    .footer { text-align: center; margin-top: 14px; font-size: 13px; }
    @media print {
      body { margin: 0; }
      .store-header .name { font-size: 18px; }
    }
  </style>
      ${
        saleData.loyaltyDiscount && saleData.loyaltyDiscount > 0
          ? `
      <div class="totals-row">
        <div class="totals-label">Loyalty Discount:</div>
    <div>-${currency}${saleData.loyaltyDiscount.toFixed(2)}</div>
      </div>
      `
          : ""
      }
      ${
        saleData.offerDiscount && saleData.offerDiscount > 0
          ? `
      <div class="totals-row">
        <div class="totals-label">Offer Discount${saleData.offerTitle ? ` (${saleData.offerTitle})` : ""}:</div>
    <div>-${currency}${saleData.offerDiscount.toFixed(2)}</div>
      </div>
      `
          : ""
      }
    ${
      saleData.discountAmount > 0
        ? `
    <div class="totals-row">
      <div class="totals-label">Discount:</div>
  <div>-${currency}${saleData.discountAmount.toFixed(2)}</div>
    </div>
    ${saleData.discountReason ? `<div style="font-size: 12px; color: #666;">(${saleData.discountReason})</div>` : ""}
    `
        : ""
    }
    <div class="store-header">
      <div class="name">${storeSettings.name}</div>
      <div class="meta">
        ${storeSettings.address}<br>
        Phone: ${storeSettings.phone}
        ${storeSettings.taxId ? `<br>Tax ID: ${storeSettings.taxId}` : ""}
      </div>
    </div>
  </div>

  <div class="receipt-info">
    <strong>Receipt #${saleData.receiptId}</strong><br>
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
          <td style="text-align: right;">${currency}${item.priceAtSale.toFixed(2)}</td>
          <td style="text-align: right;">${currency}${item.subtotal.toFixed(2)}</td>
        </tr>
        `;
        })
        .join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <div class="totals-label">Subtotal:</div>
  <div>${currency}${saleData.subtotal.toFixed(2)}</div>
    </div>
      ${
        saleData.loyaltyDiscount && saleData.loyaltyDiscount > 0
          ? `
      <div class="totals-row">
        <div class="totals-label">Loyalty Discount:</div>
    <div>-${currency}${saleData.loyaltyDiscount.toFixed(2)}</div>
      </div>
      `
          : ""
      }
    ${
      saleData.discountAmount > 0
        ? `
    <div class="totals-row">
      <div class="totals-label">Discount:</div>
  <div>-${currency}${saleData.discountAmount.toFixed(2)}</div>
    </div>
    ${saleData.discountReason ? `<div style="font-size: 12px; color: #666;">(${saleData.discountReason})</div>` : ""}
    `
        : ""
    }
    <div class="totals-row">
      <div class="totals-label">Tax:</div>
  <div>${currency}${saleData.taxAmount.toFixed(2)}</div>
    </div>
    <div class="totals-row total-final">
      <div class="totals-label">TOTAL:</div>
  <div>${currency}${saleData.finalAmount.toFixed(2)}</div>
    </div>
  </div>

  <div class="payment-info">
    <strong>Payment Details:</strong><br>
    ${(() => {
      let cashPayment = null;
      let lines = [];
      if (saleData.paymentSplits && saleData.paymentSplits.length > 0) {
        saleData.paymentSplits.forEach((split) => {
          lines.push(`${split.paymentMethod}: ${currency}${split.amount.toFixed(2)}`);
          if (split.paymentMethod === "CASH") cashPayment = split;
        });
      } else {
        if (saleData.paymentMethod === "CARD") {
          lines.push(`${saleData.paymentMethod} PAID: ${currency}${saleData.finalAmount.toFixed(2)}`);
          if (saleData.paymentMethod === "CASH") cashPayment = { amount: saleData.finalAmount };
        }
      }
      if ((saleData.paymentMethod === "CASH" || cashPayment) && saleData.cashReceived != null) {
        lines.push(`Cash Received: ${currency}${Number(saleData.cashReceived).toFixed(2)}`);
        if (saleData.changeGiven != null) {
          lines.push(`Change Amount: ${currency}${Number(saleData.changeGiven).toFixed(2)}`);
        }
      }
      return lines.join("<br>");
    })()}
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
    <p><strong>${settings.receiptFooterText || "Thank you for shopping with us!"}</strong></p>
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

export { generatePDFReceipt, generateThermalReceipt, generateHTMLReceipt };
