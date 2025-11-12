import { PrismaClient } from "@prisma/client";
import cloudinary from "../../utils/cloudinary.js";

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

export async function createCategoryService(name, file = null) {
  let iconUrl = null;

  // Upload icon to Cloudinary if file is provided
  if (file) {
    iconUrl = await uploadToCloudinary(file);
  }

  return prisma.category.create({
    data: { name: name.trim(), icon: iconUrl },
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

export async function updateCategoryService(categoryId, name, file = null) {
  const data = { name: name.trim() };

  // Upload new icon to Cloudinary if file is provided
  if (file) {
    const iconUrl = await uploadToCloudinary(file);
    data.icon = iconUrl;
  }

  return prisma.category.update({
    where: { id: categoryId },
    data,
    include: { _count: { select: { products: true } } },
  });
}

export async function deleteCategoryService(categoryId) {
  return prisma.category.delete({ where: { id: categoryId } });
}

// Helper function to upload to Cloudinary
async function uploadToCloudinary(file) {
  let iconUrl = null;

  // Upload to Cloudinary from buffer (memory storage)
  if (file.buffer) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "pos/categories", resource_type: "image" },
          (error, res) => {
            if (error) return reject(error);
            resolve(res);
          }
        );
        stream.end(file.buffer);
      });
      iconUrl = result.secure_url;
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      throw new Error("Failed to upload icon to Cloudinary");
    }
  } else if (file.path) {
    // Fallback: upload from file path
    try {
      const res = await cloudinary.uploader.upload(file.path, {
        folder: "pos/categories",
        resource_type: "image",
      });
      iconUrl = res.secure_url;
    } catch (err) {
      console.error("Cloudinary upload error from path:", err);
      throw new Error("Failed to upload icon to Cloudinary");
    }
  } else {
    throw new Error("No file provided");
  }

  return iconUrl;
}

// Upload category icon to Cloudinary (kept for backward compatibility)
export async function uploadCategoryIconService(categoryId, file) {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error("Category not found");

  const iconUrl = await uploadToCloudinary(file);

  return await prisma.category.update({
    where: { id: categoryId },
    data: { icon: iconUrl },
    include: { _count: { select: { products: true } } },
  });
}
