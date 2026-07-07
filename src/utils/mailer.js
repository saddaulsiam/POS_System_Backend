import nodemailer from "nodemailer";
import prisma from "../prisma.js";

/**
 * Send an email using SMTP configurations fetched dynamically from system settings
 * or falling back to environment variables.
 * 
 * @param {Object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.html
 * @param {Array} [params.attachments]
 */
export async function sendEmail({ to, subject, html, attachments }) {
  try {
    // Fetch settings from database
    const settings = await prisma.systemSettings.findUnique({
      where: { id: 1 },
    });

    const host = settings?.smtpHost || process.env.SMTP_HOST;
    const port = settings?.smtpPort || parseInt(process.env.SMTP_PORT || "587");
    const user = settings?.smtpUser || process.env.SMTP_USER;
    const pass = settings?.smtpPass || process.env.SMTP_PASS;
    const fromEmail = settings?.supportEmail || process.env.SUPPORT_EMAIL || "support@pos-platform.com";

    if (!host || !user || !pass) {
      console.warn("⚠️ SMTP credentials are not configured. Email dispatch skipped.");
      return { skipped: true, reason: "SMTP credentials not configured" };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // Use true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    const mailOptions = {
      from: `"POS Platform" <${fromEmail}>`,
      to,
      subject,
      html,
      attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✉️ Email sent successfully: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Email dispatch failed:", error);
    throw error;
  }
}
