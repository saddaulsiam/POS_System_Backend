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
    console.log("Registration data received:", {
      storeName,
      ownerName,
      ownerUsername,
      email,
      phone,
      address,
      city,
      country,
    });

    // Create store and owner in a transaction
    const result = await prisma.$transaction(async (tx) => {
      console.log("Step 1: Creating temp owner employee...");
      // First, create a temporary owner employee without storeId
      const tempOwner = await tx.employee.create({
        data: {
          name: ownerName,
          email: ownerEmail || null,
          phoneNumber: ownerPhone || null,
          username: ownerUsername,
          pinCode: hashedPin,
          role: "OWNER",
          isActive: true,
        },
      });
      console.log("Temp owner created:", tempOwner.id);

      console.log("Step 2: Creating store...");
      // Create the store with the owner
      const store = await tx.store.create({
        data: {
          name: storeName,
          ownerId: tempOwner.id,
        },
      });
      console.log("Store created:", store.id);

      console.log("Step 3: Updating owner with storeId...");
      // Update the owner employee with the storeId
      const owner = await tx.employee.update({
        where: { id: tempOwner.id },
        data: { storeId: store.id },
      });
      console.log("Owner updated");

      console.log("Step 4: Creating POS settings...");
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
      console.log("POS settings created:", posSettings.id);

      return { store, owner };
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
    console.error("Store registration transaction error:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    return { error: "Failed to create store. Please try again.", status: 500 };
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
      role: employee.role,
      storeId: employee.storeId,
    },
  };
}

export async function getMeService(userId) {
  return await prisma.employee.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true, role: true, isActive: true },
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
