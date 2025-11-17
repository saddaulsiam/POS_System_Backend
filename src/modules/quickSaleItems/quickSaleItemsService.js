import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getAllQuickSaleItems = async (storeId) => {
  return await prisma.quickSaleItem.findMany({
    where: { product: { storeId } },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
};

export const createQuickSaleItem = async (body, storeId) => {
  const { productId, displayName, color, sortOrder, isActive } = body;
  // Check if product exists and belongs to store
  const product = await prisma.product.findFirst({ where: { id: productId, storeId } });
  if (!product) throw new Error("Product not found in this store");
  // Check if quick sale item already exists for this product in this store
  const existing = await prisma.quickSaleItem.findFirst({ where: { productId, product: { storeId } } });
  if (existing) throw new Error("Quick sale item already exists for this product");
  return await prisma.quickSaleItem.create({
    data: {
      productId,
      displayName,
      color: color || "#3B82F6",
      sortOrder: sortOrder || 0,
      isActive: isActive !== undefined ? isActive : true,
    },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });
};

export const updateQuickSaleItem = async (id, body, storeId) => {
  const { displayName, color, sortOrder, isActive } = body;
  // Check if exists and belongs to store
  const existing = await prisma.quickSaleItem.findFirst({ where: { id, product: { storeId } } });
  if (!existing) throw new Error("Quick sale item not found in this store");
  const updateData = {};
  if (displayName !== undefined) updateData.displayName = displayName;
  if (color !== undefined) updateData.color = color;
  if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
  if (isActive !== undefined) updateData.isActive = isActive;
  return await prisma.quickSaleItem.update({
    where: { id },
    data: updateData,
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });
};

export const deleteQuickSaleItem = async (id, storeId) => {
  // Only delete if it belongs to the store
  const existing = await prisma.quickSaleItem.findFirst({ where: { id, product: { storeId } } });
  if (!existing) throw new Error("Quick sale item not found in this store");
  await prisma.quickSaleItem.delete({ where: { id } });
};
