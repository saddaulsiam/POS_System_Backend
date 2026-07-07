import PDFDocument from "pdfkit";

/**
 * Generate a professional payment invoice PDF in memory as a buffer.
 * 
 * @param {Object} payment - Payment database record
 * @param {Object} store - Associated Store database record
 * @returns {Promise<Buffer>} - Resolves to the PDF binary buffer
 */
export function generateInvoicePdf(payment, store) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];

      // Collect PDF chunks into buffer
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // --- Header Design ---
      doc
        .fillColor("#4F46E5") // Indigo Theme
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("SMART POS PLATFORM", 50, 50);

      doc
        .fillColor("#4B5563")
        .fontSize(9)
        .font("Helvetica")
        .text("Official Payment Receipt & Invoice", 50, 75);

      // Invoice Details (Right-aligned top)
      doc
        .fillColor("#1F2937")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("INVOICE DETAILS", 400, 50, { align: "right" });
      
      const issueDate = new Date(payment.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#4B5563")
        .text(`Invoice ID: INV_${payment.id}`, 400, 65, { align: "right" })
        .text(`Date: ${issueDate}`, 400, 78, { align: "right" })
        .text(`Status: PAID`, 400, 91, { align: "right" });

      // Horizontal line divider
      doc
        .strokeColor("#E5E7EB")
        .lineWidth(1)
        .moveTo(50, 115)
        .lineTo(545, 115)
        .stroke();

      // --- Billing Parties Section ---
      doc
        .fillColor("#1F2937")
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("CLIENT / BILL TO", 50, 140)
        .text("ISSUER", 300, 140);

      // Client info
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#4B5563")
        .text(`Store: ${store.name}`, 50, 155)
        .text(`Owner: ${payment.customerName}`, 50, 168)
        .text(`Email: ${payment.customerEmail}`, 50, 181)
        .text(`Phone: ${payment.customerPhone || "N/A"}`, 50, 194);

      // Issuer info
      doc
        .text("Smart POS SaaS Inc.", 300, 155)
        .text("Dhaka, Bangladesh", 300, 168)
        .text("Email: support@pos-platform.com", 300, 181)
        .text("Web: www.pos-platform.com", 300, 194);

      // --- Table Headers ---
      const tableTop = 240;
      doc
        .fillColor("#F3F4F6")
        .rect(50, tableTop, 495, 20)
        .fill();

      doc
        .fillColor("#374151")
        .font("Helvetica-Bold")
        .fontSize(9)
        .text("ITEM DESCRIPTION", 60, tableTop + 6)
        .text("QTY", 320, tableTop + 6, { width: 30, align: "center" })
        .text("UNIT PRICE", 380, tableTop + 6, { width: 60, align: "right" })
        .text("TOTAL AMOUNT", 470, tableTop + 6, { width: 70, align: "right" });

      // Table Row
      const rowTop = tableTop + 25;
      const planDescription = `Smart POS Pro License - ${payment.plan} Subscription`;
      const priceText = `$${(payment.plan === "MONTHLY" ? payment.amount : (payment.amount / 12)).toFixed(2)}`;

      doc
        .fillColor("#4B5563")
        .font("Helvetica")
        .fontSize(9)
        .text(planDescription, 60, rowTop)
        .text("1", 320, rowTop, { width: 30, align: "center" })
        .text(priceText, 380, rowTop, { width: 60, align: "right" })
        .text(`$${payment.amount.toFixed(2)}`, 470, rowTop, { width: 70, align: "right" });

      // Thin separator under item
      doc
        .strokeColor("#F3F4F6")
        .lineWidth(1)
        .moveTo(50, rowTop + 20)
        .lineTo(545, rowTop + 20)
        .stroke();

      // --- Totals Section ---
      const totalsTop = rowTop + 35;
      doc
        .fontSize(9)
        .font("Helvetica")
        .text("Subtotal:", 380, totalsTop, { width: 80, align: "right" })
        .text(`$${payment.amount.toFixed(2)}`, 470, totalsTop, { width: 70, align: "right" })
        
        .text("Tax (VAT 0%):", 380, totalsTop + 15, { width: 80, align: "right" })
        .text("$0.00", 470, totalsTop + 15, { width: 70, align: "right" })

        .font("Helvetica-Bold")
        .fillColor("#111827")
        .text("Total Paid:", 380, totalsTop + 35, { width: 80, align: "right" })
        .text(`$${payment.amount.toFixed(2)}`, 470, totalsTop + 35, { width: 70, align: "right" });

      // --- Payment Meta Box ---
      const metaTop = totalsTop;
      doc
        .fillColor("#F9FAFB")
        .rect(50, metaTop, 240, 60)
        .fill();

      doc
        .fillColor("#374151")
        .font("Helvetica-Bold")
        .fontSize(8)
        .text("PAYMENT METADATA", 60, metaTop + 8)
        .font("Helvetica")
        .text(`Transaction ID: ${payment.transactionId}`, 60, metaTop + 20)
        .text(`Gateway: ${payment.paymentMethod}`, 60, metaTop + 32)
        .text(`Card Brand: ${payment.cardBrand || "SSL COMMERZ CARD/MFS"}`, 60, metaTop + 44);

      // --- Footer ---
      const footerTop = 500;
      doc
        .strokeColor("#E5E7EB")
        .lineWidth(1)
        .moveTo(50, footerTop)
        .lineTo(545, footerTop)
        .stroke();

      doc
        .fillColor("#9CA3AF")
        .fontSize(8)
        .text("Thank you for choosing Smart POS Platform. Your payment has been processed successfully.", 50, footerTop + 15, { align: "center" })
        .text("If you have any questions about this receipt, please contact support@pos-platform.com", 50, footerTop + 27, { align: "center" });

      // Finalize and close the PDF stream
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
