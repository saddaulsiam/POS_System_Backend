const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function listVariants() {
  try {
    const variants = await prisma.productVariant.findMany({
      include: { product: true },
      orderBy: { id: "asc" },
    });
    console.log("Found", variants.length, "variants:\n");
    variants.forEach((v) => {
      console.log(
        `ID: ${v.id} | ProductId: ${v.productId} | Name: ${v.name} | SKU: ${v.sku} | Barcode: ${v.barcode} | Stock: ${v.stockQuantity}`
      );
    });
  } catch (err) {
    console.error("Error listing variants:", err);
  } finally {
    await prisma.$disconnect();
  }
}

listVariants();
