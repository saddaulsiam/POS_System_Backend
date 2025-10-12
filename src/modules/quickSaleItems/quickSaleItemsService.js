import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getAllQuickSaleItems = async () => {
  return await prisma.quickSaleItem.findMany({
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

export const createQuickSaleItem = async (body) => {
  const { productId, displayName, color, sortOrder, isActive } = body;
  // Check if product exists
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Product not found");
  // Check if quick sale item already exists for this product
  const existing = await prisma.quickSaleItem.findFirst({ where: { productId } });
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

export const updateQuickSaleItem = async (id, body) => {
  const { displayName, color, sortOrder, isActive } = body;
  // Check if exists
  const existing = await prisma.quickSaleItem.findUnique({ where: { id } });
  if (!existing) throw new Error("Quick sale item not found");
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

export const deleteQuickSaleItem = async (id) => {
  await prisma.quickSaleItem.delete({ where: { id } });
};
