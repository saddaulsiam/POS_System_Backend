import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getVariantById = async (id) => {
  return await prisma.productVariant.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          category: true,
          supplier: true,
        },
      },
    },
  });
};

export const getAllVariants = async () => {
  return await prisma.productVariant.findMany({
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
    orderBy: { id: "desc" },
  });
};

export const getVariantsByProduct = async (productId) => {
  return await prisma.productVariant.findMany({
    where: { productId },
    orderBy: { name: "asc" },
  });
};

export const createVariant = async (body) => {
  const { productId, name, sku, barcode, purchasePrice, sellingPrice, stockQuantity, isActive } = body;
  // Check if product exists
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");
  // Check for duplicate SKU
  const existingSKU = await prisma.productVariant.findUnique({ where: { sku } });
  if (existingSKU) throw new Error("SKU already exists");
  // Check for duplicate barcode if provided
  if (barcode) {
    const existingBarcode = await prisma.productVariant.findFirst({ where: { barcode } });
    if (existingBarcode) throw new Error("Barcode already exists");
  }
  const variant = await prisma.productVariant.create({
    data: {
      productId,
      name,
      sku,
      barcode,
      purchasePrice,
      sellingPrice,
      stockQuantity: stockQuantity || 0,
      isActive: isActive !== undefined ? isActive : true,
    },
  });
  // Update parent product hasVariants flag
  await prisma.product.update({
    where: { id: productId },
    data: { hasVariants: true },
  });
  return variant;
};

export const updateVariant = async (id, body) => {
  const { name, sku, barcode, purchasePrice, sellingPrice, stockQuantity, isActive } = body;
  // Check if variant exists
  const existingVariant = await prisma.productVariant.findUnique({ where: { id } });
  if (!existingVariant) throw new Error("Variant not found");
  // Check for duplicate SKU if updating
  if (sku && sku !== existingVariant.sku) {
    const duplicateSKU = await prisma.productVariant.findUnique({ where: { sku } });
    if (duplicateSKU) throw new Error("SKU already exists");
  }
  // Check for duplicate barcode if updating
  if (barcode && barcode !== existingVariant.barcode) {
    const duplicateBarcode = await prisma.productVariant.findFirst({ where: { barcode } });
    if (duplicateBarcode) throw new Error("Barcode already exists");
  }
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (sku !== undefined) updateData.sku = sku;
  if (barcode !== undefined) updateData.barcode = barcode;
  if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice;
  if (sellingPrice !== undefined) updateData.sellingPrice = sellingPrice;
  if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity;
  if (isActive !== undefined) updateData.isActive = isActive;
  return await prisma.productVariant.update({
    where: { id },
    data: updateData,
  });
};

export const deleteVariant = async (id) => {
  const variant = await prisma.productVariant.findUnique({
    where: { id },
    include: { product: true },
  });
  if (!variant) throw new Error("Variant not found");
  await prisma.productVariant.delete({ where: { id } });
  // Check if product still has variants
  const remainingVariants = await prisma.productVariant.count({ where: { productId: variant.productId } });
  if (remainingVariants === 0) {
    await prisma.product.update({ where: { id: variant.productId }, data: { hasVariants: false } });
  }
  return { message: "Variant deleted successfully" };
};

export const lookupVariant = async (identifier) => {
  return await prisma.productVariant.findFirst({
    where: {
      OR: [{ id: isNaN(identifier) ? -1 : parseInt(identifier) }, { sku: identifier }, { barcode: identifier }],
      isActive: true,
    },
    include: {
      product: {
        include: {
          category: true,
          supplier: true,
        },
      },
    },
  });
};
