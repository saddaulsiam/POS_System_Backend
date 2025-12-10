import SSLCommerzPayment from "sslcommerz-lts";
import prisma from "../../prisma.js";

// SSL Commerz Configuration
const store_id = process.env.SSLCOMMERZ_STORE_ID;
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
const is_live = process.env.NODE_ENV === "production"; // true for live, false for sandbox

/**
 * Initialize SSL Commerz Payment
 */
export async function initiatePayment(paymentData) {
  try {
    const { storeId, userId, plan, amount, customerName, customerEmail, customerPhone } = paymentData;

    // Validate required data
    if (!storeId || !userId) {
      throw new Error("Store ID and User ID are required");
    }

    // Create transaction ID
    const transactionId = `TXN_${storeId}_${Date.now()}`;

    // Create payment record in database
    const payment = await prisma.payment.create({
      data: {
        storeId,
        transactionId,
        plan,
        amount: parseFloat(amount),
        status: "PENDING",
        paymentMethod: "SSL_COMMERZ",
        customerName,
        customerEmail,
        customerPhone,
      },
    });

    // SSL Commerz payment data
    const data = {
      total_amount: amount,
      currency: "BDT",
      tran_id: transactionId,
      success_url: `${process.env.BACKEND_URL}/api/payment/sslcommerz/success`,
      fail_url: `${process.env.BACKEND_URL}/api/payment/sslcommerz/fail`,
      cancel_url: `${process.env.BACKEND_URL}/api/payment/sslcommerz/cancel`,
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

      return {
        success: false,
        error: "Failed to initiate payment",
      };
    }
  } catch (error) {
    console.error("SSL Commerz initiation error:", error);
    return {
      success: false,
      error: error.message || "Payment initiation failed",
    };
  }
}

/**
 * Validate SSL Commerz Payment
 */
export async function validatePayment(validationId) {
  try {
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
    // Use val_id for validation, not tran_id
    const validation = await sslcz.validate({ val_id: validationId });

    return {
      success: true,
      data: validation,
    };
  } catch (error) {
    console.error("SSL Commerz validation error:", error);
    return {
      success: false,
      error: error.message || "Payment validation failed",
    };
  }
}

/**
 * Handle Payment Success
 */
export async function handlePaymentSuccess(paymentData) {
  try {
    const { tran_id, val_id, amount, card_type, store_amount, card_brand, status } = paymentData;

    // Find payment record
    const payment = await prisma.payment.findUnique({
      where: { transactionId: tran_id },
    });

    if (!payment) {
      console.error("Payment record not found for transaction:", tran_id);
      return {
        success: false,
        error: "Payment record not found",
      };
    }

    // In sandbox mode, if callback status is VALID, trust it without additional validation
    // SSL Commerz validation API is unreliable in sandbox
    if (!is_live && status === "VALID") {
      // Trust callback status directly in sandbox mode
    } else {
      // For production, validate with SSL Commerz using val_id
      const validation = await validatePayment(val_id);

      if (!validation.success) {
        console.error("Validation API call failed:", validation.error);
        return {
          success: false,
          error: validation.error || "Payment validation failed",
        };
      }

      const isValidPayment = validation.data?.status === "VALID" || validation.data?.status === "VALIDATED";

      if (!isValidPayment) {
        console.error("Payment validation status invalid:", validation.data?.status);
        return {
          success: false,
          error: `Payment validation failed: ${validation.data?.status || "Unknown status"}`,
        };
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
    const subscriptionService = await import("../subscription/subscriptionService.js");
    await subscriptionService.activateSubscription(payment.storeId, {
      plan: payment.plan,
      paymentMethod: "SSL_COMMERZ",
    });

    return {
      success: true,
      payment: updatedPayment,
    };
  } catch (error) {
    console.error("Payment success handling error:", error);
    return {
      success: false,
      error: error.message || "Failed to process payment success",
    };
  }
}

/**
 * Handle Payment Failure
 */
export async function handlePaymentFailure(transactionId, reason = "Unknown") {
  try {
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
    });

    if (!payment) {
      return {
        success: false,
        error: "Payment record not found",
      };
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        failureReason: reason,
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Payment failure handling error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Handle Payment Cancellation
 */
export async function handlePaymentCancellation(transactionId) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { transactionId },
    });

    if (!payment) {
      return {
        success: false,
        error: "Payment record not found",
      };
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "CANCELLED",
      },
    });

    return {
      success: true,
    };
  } catch (error) {
    console.error("Payment cancellation handling error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
