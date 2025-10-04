const nodemailer = require("nodemailer");

/**
 * Email service configuration
 * In production, use environment variables for credentials
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.config = {
      from: process.env.EMAIL_FROM || "noreply@possystem.com",
      storeName: process.env.STORE_NAME || "POS System",
    };
  }

  /**
   * Initialize email transporter
   * Configure based on environment (Gmail, SendGrid, AWS SES, etc.)
   */
  async initialize() {
    // Development mode - use ethereal email (fake SMTP for testing)
    if (process.env.NODE_ENV !== "production") {
      try {
        const testAccount = await nodemailer.createTestAccount();

        this.transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });

        console.log("📧 Email service initialized (Test Mode - Ethereal)");
        console.log("   Preview emails at: https://ethereal.email");
        return;
      } catch (error) {
        console.warn("⚠️  Could not connect to Ethereal email service:", error.message);
        console.log("📧 Email service will work in offline mode (emails will be logged only)");
        // Create a simple transporter that logs instead of sending
        this.transporter = nodemailer.createTransport({
          streamTransport: true,
          newline: "unix",
          buffer: true,
        });
        return;
      }
    }

    // Production mode - configure based on provider
    const emailProvider = process.env.EMAIL_PROVIDER || "smtp";

    switch (emailProvider.toLowerCase()) {
      case "gmail":
        this.transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD, // Use app-specific password
          },
        });
        break;

      case "sendgrid":
        this.transporter = nodemailer.createTransport({
          host: "smtp.sendgrid.net",
          port: 587,
          auth: {
            user: "apikey",
            pass: process.env.SENDGRID_API_KEY,
          },
        });
        break;

      case "ses": // AWS Simple Email Service
        // Requires aws-sdk package
        const aws = require("@aws-sdk/client-ses");
        const { defaultProvider } = require("@aws-sdk/credential-provider-node");

        const ses = new aws.SES({
          apiVersion: "2010-12-01",
          region: process.env.AWS_REGION || "us-east-1",
          credentialDefaultProvider: defaultProvider(),
        });

        this.transporter = nodemailer.createTransport({
          SES: { ses, aws },
        });
        break;

      case "smtp":
      default:
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD,
          },
        });
        break;
    }

    // Verify connection
    try {
      await this.transporter.verify();
      console.log("📧 Email service initialized successfully");
    } catch (error) {
      console.error("❌ Email service initialization failed:", error.message);
      console.log("   Emails will not be sent until configuration is fixed");
    }
  }

  /**
   * Send receipt email to customer
   * @param {string} recipientEmail - Customer email address
   * @param {string} recipientName - Customer name
   * @param {string} htmlContent - HTML receipt content
   * @param {Object} attachments - Optional PDF attachment
   * @returns {Promise<Object>} Send result
   */
  async sendReceipt(recipientEmail, recipientName, htmlContent, attachments = null) {
    if (!this.transporter) {
      await this.initialize();
    }

    const mailOptions = {
      from: `"${this.config.storeName}" <${this.config.from}>`,
      to: `"${recipientName}" <${recipientEmail}>`,
      subject: `Receipt from ${this.config.storeName}`,
      html: htmlContent,
      attachments: attachments ? [attachments] : [],
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);

      // For test emails (Ethereal), log preview URL
      if (process.env.NODE_ENV !== "production") {
        console.log("📧 Test email sent!");
        console.log("   Preview URL:", nodemailer.getTestMessageUrl(info));
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: nodemailer.getTestMessageUrl(info) || null,
      };
    } catch (error) {
      console.error("❌ Failed to send email:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send receipt with PDF attachment
   * @param {string} recipientEmail
   * @param {string} recipientName
   * @param {string} htmlContent
   * @param {Buffer} pdfBuffer - PDF file buffer
   * @param {string} receiptNumber - Receipt number for filename
   */
  async sendReceiptWithPDF(recipientEmail, recipientName, htmlContent, pdfBuffer, receiptNumber) {
    const attachment = {
      filename: `receipt_${receiptNumber}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    };

    return this.sendReceipt(recipientEmail, recipientName, htmlContent, attachment);
  }

  /**
   * Send promotional email to customers
   * @param {Array} recipients - Array of {email, name} objects
   * @param {string} subject
   * @param {string} htmlContent
   */
  async sendBulkEmail(recipients, subject, htmlContent) {
    if (!this.transporter) {
      await this.initialize();
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [],
    };

    for (const recipient of recipients) {
      try {
        const mailOptions = {
          from: `"${this.config.storeName}" <${this.config.from}>`,
          to: `"${recipient.name}" <${recipient.email}>`,
          subject: subject,
          html: htmlContent,
        };

        await this.transporter.sendMail(mailOptions);
        results.sent++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: recipient.email,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Send loyalty reward notification
   * @param {string} recipientEmail
   * @param {string} recipientName
   * @param {Object} rewardData - Reward information
   */
  async sendLoyaltyReward(recipientEmail, recipientName, rewardData) {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .reward-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #667eea; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 You've Earned a Reward!</h1>
  </div>
  <div class="content">
    <p>Hi ${recipientName},</p>
    <p>Great news! You've earned a new loyalty reward:</p>
    
    <div class="reward-box">
      <h2>${rewardData.title}</h2>
      <p>${rewardData.description}</p>
      <p><strong>Value:</strong> ${rewardData.value}</p>
      ${
        rewardData.expiresAt
          ? `<p><strong>Valid until:</strong> ${new Date(rewardData.expiresAt).toLocaleDateString()}</p>`
          : ""
      }
    </div>

    <p>Visit us to redeem your reward!</p>
    
    <p>Thank you for being a valued customer.</p>
    
    <p>Best regards,<br>${this.config.storeName}</p>
  </div>
</body>
</html>
    `;

    return this.sendReceipt(recipientEmail, recipientName, htmlContent);
  }

  /**
   * Send low stock alert to admin
   * @param {string} adminEmail
   * @param {Array} lowStockProducts - Array of products with low stock
   */
  async sendLowStockAlert(adminEmail, lowStockProducts) {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .critical { color: #dc3545; font-weight: bold; }
  </style>
</head>
<body>
  <div class="alert">
    <h2>⚠️ Low Stock Alert</h2>
    <p>The following products are running low on stock and need attention:</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>Current Stock</th>
        <th>Reorder Level</th>
      </tr>
    </thead>
    <tbody>
      ${lowStockProducts
        .map(
          (product) => `
        <tr>
          <td>${product.name}</td>
          <td class="${product.stockQuantity === 0 ? "critical" : ""}">${product.stockQuantity}</td>
          <td>${product.reorderLevel || "Not set"}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <p style="margin-top: 30px;">Please reorder these items to maintain stock levels.</p>
</body>
</html>
    `;

    const mailOptions = {
      from: `"${this.config.storeName} Alerts" <${this.config.from}>`,
      to: adminEmail,
      subject: "⚠️ Low Stock Alert - Immediate Action Required",
      html: htmlContent,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return { success: true };
    } catch (error) {
      console.error("Failed to send low stock alert:", error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
