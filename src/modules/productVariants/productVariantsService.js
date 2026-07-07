import prisma from "../../prisma.js";

export const getVariantById = async (id, storeId) => {
  // Only return variant if its parent product belongs to storeId
  return await prisma.productVariant.findFirst({
    where: {
      id,
      product: { storeId },
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

export const getAllVariants = async (storeId) => {
  return await prisma.productVariant.findMany({
    where: { product: { storeId } },
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

export const getVariantsByProduct = async (productId, storeId) => {
  // Only return variants if the product belongs to storeId
  const product = await prisma.product.findFirst({ where: { id: productId, storeId } });
  if (!product) throw new Error("Product not found in this store");
  return await prisma.productVariant.findMany({
    where: { productId },
    orderBy: { name: "asc" },
  });
};

async function syncProductStock(productId) {
  const variants = await prisma.productVariant.findMany({
    where: { productId, isActive: true },
    select: { stockQuantity: true }
  });
  const totalStock = variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
  await prisma.product.update({
    where: { id: productId },
    data: { stockQuantity: totalStock }
  });
}

export const createVariant = async (body, storeId) => {
  const { productId, name, sku, barcode, purchasePrice, sellingPrice, stockQuantity, isActive } = body;
  // Check if product exists and belongs to store
  const product = await prisma.product.findFirst({ where: { id: productId, storeId } });
  if (!product) throw new Error("Product not found in this store");
  // Check for duplicate SKU in this store
  const existingSKU = await prisma.productVariant.findFirst({ where: { sku, product: { storeId } } });
  if (existingSKU) throw new Error("SKU already exists in this store");
  // Check for duplicate barcode if provided in this store
  if (barcode) {
    const existingBarcode = await prisma.productVariant.findFirst({ where: { barcode, product: { storeId } } });
    if (existingBarcode) throw new Error("Barcode already exists in this store");
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
  await syncProductStock(productId);
  return variant;
};

export const updateVariant = async (id, body, storeId) => {
  const { name, sku, barcode, purchasePrice, sellingPrice, stockQuantity, isActive } = body;
  // Check if variant exists and belongs to a product in this store
  const existingVariant = await prisma.productVariant.findFirst({ where: { id, product: { storeId } } });
  if (!existingVariant) throw new Error("Variant not found in this store");
  // Check for duplicate SKU if updating in this store
  if (sku && sku !== existingVariant.sku) {
    const duplicateSKU = await prisma.productVariant.findFirst({
      where: { sku, product: { storeId }, id: { not: id } },
    });
    if (duplicateSKU) throw new Error("SKU already exists in this store");
  }
  // Check for duplicate barcode if updating in this store
  if (barcode && barcode !== existingVariant.barcode) {
    const duplicateBarcode = await prisma.productVariant.findFirst({
      where: { barcode, product: { storeId }, id: { not: id } },
    });
    if (duplicateBarcode) throw new Error("Barcode already exists in this store");
  }
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (sku !== undefined) updateData.sku = sku;
  if (barcode !== undefined) updateData.barcode = barcode;
  if (purchasePrice !== undefined) updateData.purchasePrice = purchasePrice;
  if (sellingPrice !== undefined) updateData.sellingPrice = sellingPrice;
  if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity;
  if (isActive !== undefined) updateData.isActive = isActive;
  const updatedVariant = await prisma.productVariant.update({
    where: { id },
    data: updateData,
  });
  await syncProductStock(existingVariant.productId);
  return updatedVariant;
};

export const deleteVariant = async (id, storeId) => {
  // Only allow delete if variant belongs to a product in this store
  const variant = await prisma.productVariant.findFirst({
    where: { id, product: { storeId } },
    include: { product: true },
  });
  if (!variant) throw new Error("Variant not found in this store");
  await prisma.productVariant.delete({ where: { id } });
  // Check if product still has variants
  const remainingVariants = await prisma.productVariant.count({ where: { productId: variant.productId } });
  if (remainingVariants === 0) {
    await prisma.product.update({ where: { id: variant.productId }, data: { hasVariants: false } });
  }
  await syncProductStock(variant.productId);
  return { message: "Variant deleted successfully" };
};

export const lookupVariant = async (identifier, storeId) => {
  const parsedId = isNaN(identifier) ? -1 : parseInt(identifier);
  // Ensure parsedId fits in a 32-bit signed integer to prevent database overflow crashes
  const idQuery = (parsedId > 0 && parsedId <= 2147483647) ? parsedId : -1;

  // Only return variant if its parent product belongs to storeId
  return await prisma.productVariant.findFirst({
    where: {
      OR: [
        { id: idQuery },
        { sku: identifier },
        { barcode: identifier }
      ],
      isActive: true,
      product: { storeId },
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
