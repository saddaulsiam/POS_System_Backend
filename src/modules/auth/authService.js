import prisma from "../../prisma.js";
import { comparePassword, generateToken, hashPassword, logAudit } from "../../utils/helpers.js";

export async function registerStoreService({
  storeName,
  ownerName,
  ownerEmail,
  ownerPhone,
  ownerUsername,
  ownerPin,
  email,
  phone,
  address,
  city,
  country,
}) {
  // Check if username already exists
  const existingUser = await prisma.employee.findUnique({
    where: { username: ownerUsername },
  });

  if (existingUser) {
    return { error: "Username already exists", status: 400 };
  }

  // Check if owner email already exists (if provided)
  if (ownerEmail) {
    const existingOwnerEmail = await prisma.employee.findUnique({
      where: { email: ownerEmail },
    });

    if (existingOwnerEmail) {
      return { error: "Owner email already registered", status: 400 };
    }
  }

  // Check if store email already exists (if provided)
  if (email) {
    const existingStoreEmail = await prisma.pOSSettings.findUnique({
      where: { storeEmail: email },
    });

    if (existingStoreEmail) {
      return { error: "Store email already registered", status: 400 };
    }
  }

  // Hash the PIN
  const hashedPin = await hashPassword(ownerPin);

  try {
    // Create store and owner in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // First, create a temporary owner employee without storeId
      const tempOwner = await tx.employee.create({
        data: {
          name: ownerName,
          email: ownerEmail || null,
          phone: ownerPhone || null,
          username: ownerUsername,
          pinCode: hashedPin,
          role: "OWNER",
          isActive: true,
        },
      });

      // Create the store with the owner
      const store = await tx.store.create({
        data: {
          name: storeName,
          ownerId: tempOwner.id,
        },
      });

      // Update the owner with the storeId
      const owner = await tx.employee.update({
        where: { id: tempOwner.id },
        data: { storeId: store.id },
      });

      // Create default POS settings for the store with contact info
      const posSettingsData = {
        storeId: store.id,
        storeName: storeName,
        storeAddress: address || "",
        storePhone: phone || "",
        receiptFooterText: `Thank you for shopping at ${storeName}!`,
        returnPolicy: "Returns accepted within 7 days with receipt.",
        printReceiptAuto: false,
        autoPrintThermal: false,
      };

      // Only add email if provided (to avoid unique constraint issues)
      if (email && email.trim()) {
        posSettingsData.storeEmail = email;
      }

      const posSettings = await tx.pOSSettings.create({
        data: posSettingsData,
      });

      // Create subscription with 10-day trial period
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 10);

      const subscription = await tx.subscription.create({
        data: {
          storeId: store.id,
          status: "TRIAL",
          trialStartDate: new Date(),
          trialEndDate: trialEndDate,
        },
      });

      return { store, owner, subscription };
    });

    // Generate token for auto-login
    const token = generateToken(result.owner.id, result.owner.role, result.store.id);

    return {
      token,
      store: {
        id: result.store.id,
        name: result.store.name,
      },
      user: {
        id: result.owner.id,
        name: result.owner.name,
        username: result.owner.username,
        role: result.owner.role,
        storeId: result.store.id,
      },
    };
  } catch (error) {
    // Return more specific error message if available
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0] || "field";
      return { error: `This ${field} is already registered`, status: 400 };
    }

    return { error: `Registration failed: ${error.message}`, status: 500 };
  }
}

export async function loginService(username, pinCode, req) {
  const employee = await prisma.employee.findUnique({ where: { username } });
  if (!employee || !employee.isActive) {
    return { error: "Invalid credentials or inactive account", status: 401 };
  }
  const isValidPin = await comparePassword(pinCode, employee.pinCode);
  if (!isValidPin) {
    return { error: "Invalid credentials", status: 401 };
  }
  const token = generateToken(employee.id, employee.role, employee.storeId);
  await logAudit({
    userId: employee.id,
    action: "LOGIN",
    entity: "Employee",
    entityId: employee.id,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] || "",
  });
  return {
    token,
    user: {
      id: employee.id,
      name: employee.name,
      username: employee.username,
      email: employee.email,
      role: employee.role,
      storeId: employee.storeId,
      createdAt: employee.createdAt,
      updatedAt: employee.updatedAt,
    },
  };
}

export async function getMeService(userId) {
  return await prisma.employee.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      storeId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function changePinService(userId, currentPin, newPin, storeId) {
  const employee = await prisma.employee.findFirst({ where: { id: userId, storeId } });
  if (!employee) {
    return { error: "User not found", status: 404 };
  }
  const isValidCurrentPin = await comparePassword(currentPin, employee.pinCode);
  if (!isValidCurrentPin) {
    return { error: "Current PIN is incorrect", status: 401 };
  }
  const hashedNewPin = await hashPassword(newPin);
  await prisma.employee.update({
    where: { id: userId },
    data: { pinCode: hashedNewPin },
  });
  return { message: "PIN changed successfully" };
}
