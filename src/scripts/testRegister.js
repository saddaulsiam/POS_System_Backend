import prisma from "../prisma.js";
import { hashPassword } from "../utils/helpers.js";

async function testRegistration() {
  try {
    console.log("🧪 Testing Store Registration...\n");

    const testData = {
      storeName: "Test Store " + Date.now(),
      ownerName: "Test Owner",
      ownerEmail: "test" + Date.now() + "@example.com",
      ownerPhone: "+880191234" + Math.floor(Math.random() * 10000),
      ownerUsername: "testuser" + Date.now(),
      ownerPin: "1234",
      email: "store" + Date.now() + "@example.com",
      phone: "+880171234" + Math.floor(Math.random() * 10000),
      address: "Test Address",
      city: "Dhaka",
      country: "Bangladesh",
    };

    console.log("📝 Test Data:", testData);
    console.log("\n" + "=".repeat(50) + "\n");

    // Check for existing username
    console.log("1️⃣ Checking for existing username...");
    const existingUser = await prisma.employee.findUnique({
      where: { username: testData.ownerUsername },
    });
    if (existingUser) {
      console.log("❌ Username already exists!");
      return;
    }
    console.log("✅ Username is available\n");

    // Check for existing owner email
    if (testData.ownerEmail) {
      console.log("2️⃣ Checking for existing owner email...");
      const existingOwnerEmail = await prisma.employee.findUnique({
        where: { email: testData.ownerEmail },
      });
      if (existingOwnerEmail) {
        console.log("❌ Owner email already exists!");
        return;
      }
      console.log("✅ Owner email is available\n");
    }

    // Check for existing store email
    if (testData.email) {
      console.log("3️⃣ Checking for existing store email...");
      const existingStoreEmail = await prisma.pOSSettings.findUnique({
        where: { storeEmail: testData.email },
      });
      if (existingStoreEmail) {
        console.log("❌ Store email already exists!");
        return;
      }
      console.log("✅ Store email is available\n");
    }

    // Hash PIN
    console.log("4️⃣ Hashing PIN...");
    const hashedPin = await hashPassword(testData.ownerPin);
    console.log("✅ PIN hashed\n");

    // Start transaction
    console.log("5️⃣ Starting transaction...\n");
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Create temp owner
      console.log("   📌 Step 1: Creating temp owner employee...");
      const tempOwner = await tx.employee.create({
        data: {
          name: testData.ownerName,
          email: testData.ownerEmail || null,
          phone: testData.ownerPhone || null,
          username: testData.ownerUsername,
          pinCode: hashedPin,
          role: "OWNER",
          isActive: true,
        },
      });
      console.log("   ✅ Temp owner created:", tempOwner.id);

      // Step 2: Create store
      console.log("   📌 Step 2: Creating store...");
      const store = await tx.store.create({
        data: {
          name: testData.storeName,
          ownerId: tempOwner.id,
        },
      });
      console.log("   ✅ Store created:", store.id);

      // Step 3: Update owner with storeId
      console.log("   📌 Step 3: Updating owner with storeId...");
      const owner = await tx.employee.update({
        where: { id: tempOwner.id },
        data: { storeId: store.id },
      });
      console.log("   ✅ Owner updated with storeId:", owner.storeId);

      // Step 4: Create POS settings
      console.log("   📌 Step 4: Creating POS settings...");
      const posSettingsData = {
        storeId: store.id,
        storeName: testData.storeName,
        storeAddress: testData.address || "",
        storePhone: testData.phone || "",
        receiptFooterText: `Thank you for shopping at ${testData.storeName}!`,
        returnPolicy: "Returns accepted within 7 days with receipt.",
        printReceiptAuto: false,
        autoPrintThermal: false,
      };

      if (testData.email && testData.email.trim()) {
        posSettingsData.storeEmail = testData.email;
      }

      const posSettings = await tx.pOSSettings.create({
        data: posSettingsData,
      });
      console.log("   ✅ POS settings created:", posSettings.id);

      // Step 5: Create subscription
      console.log("   📌 Step 5: Creating subscription with 10-day trial...");
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
      console.log("   ✅ Subscription created:", subscription.id);

      return { store, owner, subscription };
    });

    console.log("\n" + "=".repeat(50));
    console.log("🎉 Registration Successful!\n");
    console.log("Store:", result.store.name, "(ID:", result.store.id + ")");
    console.log("Owner:", result.owner.name, "(ID:", result.owner.id + ")");
    console.log("Subscription:", result.subscription.status, "(Trial ends:", result.subscription.trialEndDate + ")");
    console.log("\n✅ All tests passed!");
  } catch (error) {
    console.error("\n" + "=".repeat(50));
    console.error("❌ Registration Failed!\n");
    console.error("Error Type:", error.constructor.name);
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);

    if (error.meta) {
      console.error("Error Meta:", JSON.stringify(error.meta, null, 2));
    }

    if (error.code === "P2002") {
      console.error("\n⚠️  Unique constraint violation!");
      console.error("Field:", error.meta?.target);
    }

    console.error("\nFull Error:");
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testRegistration();
