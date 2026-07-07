import SSLCommerzPayment from "sslcommerz-lts";
import prisma from "../../prisma.js";

// SSL Commerz Configuration
const store_id = process.env.SSLCOMMERZ_STORE_ID;
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
const is_live = process.env.SSLCOMMERZ_IS_LIVE === "true";

/**
 * Initialize SSL Commerz Payment
 */
export async function initiatePayment(paymentData) {
  try {
    const { storeId, userId, plan, amount, customerName, customerEmail, customerPhone, platform = "web" } = paymentData;

    // Validate required data
    if (!storeId || !userId) {
      throw new Error("Store ID and User ID are required for payment initiation");
    }

    if (!plan || !amount) {
      throw new Error("Subscription plan and amount are required");
    }

    if (!customerName || !customerEmail || !customerPhone) {
      throw new Error("Customer name, email, and phone number are required for payment");
    }

    // Validate amount against dynamic pricing in system settings
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error("Invalid payment amount. Amount must be greater than zero");
    }

    const systemSettings = await prisma.systemSettings.findUnique({
      where: { id: 1 },
    });

    if (!systemSettings) {
      throw new Error("System configurations not loaded. Please contact administrator.");
    }

    let expectedAmount = 0;
    if (plan === "MONTHLY") {
      expectedAmount = systemSettings.monthlyPrice;
    } else if (plan === "YEARLY") {
      expectedAmount = systemSettings.yearlyPrice * 12; // Yearly plan bills monthly price * 12 months
    } else {
      throw new Error("Invalid subscription plan selection.");
    }

    if (parsedAmount !== expectedAmount) {
      throw new Error(`Payment verification failed: Amount mismatch. Expected $${expectedAmount} for ${plan} plan.`);
    }

    // Create transaction ID
    const transactionId = `TXN_${storeId}_${Date.now()}`;

    // Create payment record in database
    const payment = await prisma.payment.create({
      data: {
        storeId,
        transactionId,
        plan,
        amount: parsedAmount,
        status: "PENDING",
        paymentMethod: "SSL_COMMERZ",
        customerName,
        customerEmail,
        customerPhone,
      },
    });

    // Validate SSL Commerz credentials
    if (!store_id || !store_passwd) {
      await prisma.payment.delete({ where: { id: payment.id } });
      throw new Error("Payment gateway is not configured. Please contact support");
    }

    // SSL Commerz payment data
    const data = {
      total_amount: amount,
      currency: "BDT",
      tran_id: transactionId,
      success_url: `${process.env.BACKEND_URL}/api/payment/sslcommerz/success?platform=${platform}`,
      fail_url: `${process.env.BACKEND_URL}/api/payment/sslcommerz/fail?platform=${platform}`,
      cancel_url: `${process.env.BACKEND_URL}/api/payment/sslcommerz/cancel?platform=${platform}`,
      ipn_url: `${process.env.BACKEND_URL}/api/payment/sslcommerz/ipn`,
      shipping_method: "NO",
      product_name: `POS Subscription - ${plan}`,
      product_category: "Software",
      product_profile: "general",
      cus_name: customerName,
      cus_email: customerEmail,
      cus_add1: "N/A",
      cus_city: "N/A",
      cus_state: "N/A",
      cus_postcode: "N/A",
      cus_country: "Bangladesh",
      cus_phone: customerPhone,
      cus_fax: "N/A",
      ship_name: customerName,
      ship_add1: "N/A",
      ship_city: "N/A",
      ship_state: "N/A",
      ship_postcode: "N/A",
      ship_country: "Bangladesh",
      value_a: storeId.toString(), // Store custom data
      value_b: userId.toString(),
      value_c: plan,
    };

    // Initialize SSL Commerz
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    const apiResponse = await sslcz.init(data);

    if (apiResponse?.GatewayPageURL) {
      return {
        success: true,
        gatewayUrl: apiResponse.GatewayPageURL,
        transactionId,
        paymentId: payment.id,
      };
    } else {
      // Delete payment record if initiation fails
      await prisma.payment.delete({ where: { id: payment.id } });

      // Check for specific error messages from SSL Commerz
      const errorMessage = apiResponse?.failedreason || apiResponse?.status || "Payment gateway failed to initialize";

      return {
        success: false,
        error: `Payment initiation failed: ${errorMessage}. Please try again or contact support`,
      };
    }
  } catch (error) {
    console.error("SSL Commerz initiation error:", error);

    // Provide specific error messages based on error type
    let errorMessage = "Payment initiation failed. Please try again";

    if (error.message.includes("required")) {
      errorMessage = error.message;
    } else if (error.code === "P2002") {
      errorMessage = "Duplicate transaction detected. Please refresh and try again";
    } else if (error.code === "P2003") {
      errorMessage = "Invalid store information. Please contact support";
    } else if (error.message.includes("network") || error.message.includes("ECONNREFUSED")) {
      errorMessage = "Network error. Please check your connection and try again";
    } else if (error.message.includes("timeout")) {
      errorMessage = "Payment gateway timeout. Please try again";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Validate SSL Commerz Payment
 */
export async function validatePayment(validationId) {
  try {
    if (!validationId) {
      throw new Error("Validation ID is required");
    }

    if (!store_id || !store_passwd) {
      throw new Error("Payment gateway credentials not configured");
    }

    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    // Use val_id for validation, not tran_id
    const validation = await sslcz.validate({ val_id: validationId });

    if (!validation) {
      throw new Error("Payment validation returned empty response");
    }

    return {
      success: true,
      data: validation,
    };
  } catch (error) {
    console.error("SSL Commerz validation error:", error);

    let errorMessage = "Payment validation failed";

    if (error.message.includes("required") || error.message.includes("configured")) {
      errorMessage = error.message;
    } else if (error.message.includes("network") || error.message.includes("ECONNREFUSED")) {
      errorMessage = "Unable to connect to payment gateway for validation";
    } else if (error.message.includes("timeout")) {
      errorMessage = "Payment validation timeout. Please try again";
    } else if (error.response?.data?.message) {
      errorMessage = `Validation failed: ${error.response.data.message}`;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Handle Payment Success
 */
export async function handlePaymentSuccess(paymentData) {
  try {
    const { tran_id, val_id, amount, card_type, store_amount, card_brand, status } = paymentData;

    if (!tran_id) {
      throw new Error("Transaction ID is missing from payment data");
    }

    // Find payment record
    const payment = await prisma.payment.findUnique({
      where: { transactionId: tran_id },
    });

    if (!payment) {
      console.error("Payment record not found for transaction:", tran_id);
      throw new Error(`Payment record not found for transaction ${tran_id}. Please contact support`);
    }

    if (payment.status === "SUCCESS") {
      return {
        success: true,
        payment,
        message: "Payment already processed successfully",
      };
    }

    // In sandbox mode, if callback status is VALID, trust it without additional validation
    // SSL Commerz validation API is unreliable in sandbox
    if (!is_live && status === "VALID") {
      // Trust callback status directly in sandbox mode
      console.log("Sandbox mode: Trusting callback status directly");
    } else {
      // For production, validate with SSL Commerz using val_id
      if (!val_id) {
        throw new Error("Validation ID is missing. Cannot verify payment");
      }

      const validation = await validatePayment(val_id);

      if (!validation.success) {
        console.error("Validation API call failed:", validation.error);
        throw new Error(`Payment verification failed: ${validation.error}`);
      }

      const isValidPayment = validation.data?.status === "VALID" || validation.data?.status === "VALIDATED";

      if (!isValidPayment) {
        const validationStatus = validation.data?.status || "Unknown";
        console.error("Payment validation status invalid:", validationStatus);
        throw new Error(`Payment verification failed. Status: ${validationStatus}`);
      }
    }

    // Update payment record
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        validationId: val_id,
        cardType: card_type,
        cardBrand: card_brand,
        storeAmount: store_amount ? parseFloat(store_amount) : null,
        completedAt: new Date(),
      },
    });

    // Activate subscription
    try {
      const subscriptionService = await import("../subscription/subscriptionService.js");
      await subscriptionService.activateSubscription(payment.storeId, {
        plan: payment.plan,
        paymentMethod: "SSL_COMMERZ",
      });
    } catch (subError) {
      console.error("Subscription activation error:", subError);
      // Payment succeeded but subscription activation failed
      throw new Error(
        `Payment successful but subscription activation failed: ${subError.message}. Please contact support`,
      );
    }

    // Fetch store details to include in invoice
    const store = await prisma.store.findUnique({
      where: { id: payment.storeId },
    });

    // Asynchronously generate and send invoice email (non-blocking)
    (async () => {
      try {
        const { generateInvoicePdf } = await import("../../utils/invoiceGenerator.js");
        const { sendEmail } = await import("../../utils/mailer.js");

        if (store) {
          const pdfBuffer = await generateInvoicePdf(updatedPayment, store);
          await sendEmail({
            to: updatedPayment.customerEmail,
            subject: `Payment Invoice - ${store.name}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h2 style="color: #4f46e5; margin-bottom: 20px;">Thank You for Your Payment!</h2>
                <p>Hello <strong>${updatedPayment.customerName}</strong>,</p>
                <p>Your subscription payment for <strong>${store.name}</strong> was processed successfully. Your Smart POS subscription is now active.</p>
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 5px 0; color: #4b5563;">Transaction ID:</td>
                      <td style="padding: 5px 0; text-align: right; font-weight: bold;">${updatedPayment.transactionId}</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; color: #4b5563;">Plan:</td>
                      <td style="padding: 5px 0; text-align: right; font-weight: bold;">${updatedPayment.plan}</td>
                    </tr>
                    <tr>
                      <td style="padding: 5px 0; color: #4b5563;">Amount:</td>
                      <td style="padding: 5px 0; text-align: right; font-weight: bold; color: #111827;">$${updatedPayment.amount.toFixed(2)}</td>
                    </tr>
                  </table>
                </div>
                <p>We have attached the official PDF invoice receipt to this email for your records.</p>
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center;">Smart POS SaaS Inc. &bull; Dhaka, Bangladesh &bull; support@pos-platform.com</p>
              </div>
            `,
            attachments: [
              {
                filename: `Invoice_${updatedPayment.transactionId}.pdf`,
                content: pdfBuffer,
              },
            ],
          });
        }
      } catch (emailErr) {
        console.error("❌ Failed to automatically send PDF invoice email:", emailErr);
      }
    })();

    return {
      success: true,
      payment: updatedPayment,
      message: "Payment processed and subscription activated successfully",
    };
  } catch (error) {
    console.error("Payment success handling error:", error);

    let errorMessage = "Failed to process payment";

    if (error.message.includes("not found") || error.message.includes("missing")) {
      errorMessage = error.message;
    } else if (error.message.includes("verification failed") || error.message.includes("validation")) {
      errorMessage = error.message;
    } else if (error.message.includes("subscription")) {
      errorMessage = error.message;
    } else if (error.code === "P2025") {
      errorMessage = "Payment record not found in database. Please contact support";
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Handle Payment Failure
 */
export async function handlePaymentFailure(transactionId, reason = "Unknown") {
  try {
    if (!transactionId) {
      throw new Error("Transaction ID is required to handle payment failure");
    }

    const payment = await prisma.payment.findUnique({
      where: { transactionId },
    });

    if (!payment) {
      throw new Error(`Payment record not found for transaction ${transactionId}`);
    }

    if (payment.status === "FAILED") {
      return {
        success: true,
        message: "Payment already marked as failed",
      };
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureReason: reason || "Payment declined or failed",
      },
    });

    return {
      success: true,
      message: "Payment failure recorded",
    };
  } catch (error) {
    console.error("Payment failure handling error:", error);

    let errorMessage = "Failed to record payment failure";

    if (error.message.includes("not found") || error.message.includes("required")) {
      errorMessage = error.message;
    } else if (error.code === "P2025") {
      errorMessage = "Payment record not found in database";
    } else if (error.message) {
      errorMessage = `Error recording payment failure: ${error.message}`;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Handle Payment Cancellation
 */
export async function handlePaymentCancellation(transactionId) {
  try {
    if (!transactionId) {
      throw new Error("Transaction ID is required to handle payment cancellation");
    }

    const payment = await prisma.payment.findUnique({
      where: { transactionId },
    });

    if (!payment) {
      throw new Error(`Payment record not found for transaction ${transactionId}`);
    }

    if (payment.status === "CANCELLED") {
      return {
        success: true,
        message: "Payment already marked as cancelled",
      };
    }

    if (payment.status === "SUCCESS") {
      throw new Error("Cannot cancel a successful payment. Please contact support for refund");
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "CANCELLED",
      },
    });

    return {
      success: true,
      message: "Payment cancellation recorded",
    };
  } catch (error) {
    console.error("Payment cancellation handling error:", error);

    let errorMessage = "Failed to record payment cancellation";

    if (error.message.includes("not found") || error.message.includes("required")) {
      errorMessage = error.message;
    } else if (error.message.includes("Cannot cancel")) {
      errorMessage = error.message;
    } else if (error.code === "P2025") {
      errorMessage = "Payment record not found in database";
    } else if (error.message) {
      errorMessage = `Error recording payment cancellation: ${error.message}`;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}
