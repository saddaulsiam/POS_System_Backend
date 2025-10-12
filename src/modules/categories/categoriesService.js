import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function fetchCategories() {
  return prisma.category.findMany({
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

export async function fetchCategoryById(categoryId) {
  return prisma.category.findUnique({
    where: { id: categoryId },
    include: {
      products: { where: { isActive: true }, orderBy: { name: "asc" } },
      _count: { select: { products: true } },
    },
  });
}

export async function createCategoryService(name) {
  return prisma.category.create({
    data: { name: name.trim() },
    include: { _count: { select: { products: true } } },
  });
}

export async function findCategoryByName(name) {
  return prisma.category.findUnique({ where: { name: name.trim() } });
}

export async function findCategoryById(categoryId) {
  return prisma.category.findUnique({ where: { id: categoryId } });
}

export async function findNameConflict(name, categoryId) {
  return prisma.category.findFirst({
    where: { name: name.trim(), id: { not: categoryId } },
  });
}

export async function updateCategoryService(categoryId, name) {
  return prisma.category.update({
    where: { id: categoryId },
    data: { name: name.trim() },
    include: { _count: { select: { products: true } } },
  });
}

export async function deleteCategoryService(categoryId) {
  return prisma.category.delete({ where: { id: categoryId } });
}
