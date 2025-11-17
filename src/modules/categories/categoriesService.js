import prisma from "../../prisma.js";
import cloudinary from "../../utils/cloudinary.js";

export async function fetchCategories(storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.category.findMany({
    where: { storeId },
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

export async function fetchCategoryById(categoryId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.category.findFirst({
    where: { id: categoryId, storeId },
    include: {
      products: { where: { isActive: true }, orderBy: { name: "asc" } },
      _count: { select: { products: true } },
    },
  });
}

export async function createCategoryService(name, file = null, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  let iconUrl = null;
  if (file) {
    iconUrl = await uploadToCloudinary(file);
  }
  return prisma.category.create({
    data: { name: name.trim(), icon: iconUrl, storeId },
    include: { _count: { select: { products: true } } },
  });
}

export async function findCategoryByName(name, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.category.findFirst({ where: { name: name.trim(), storeId } });
}

export async function findCategoryById(categoryId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.category.findFirst({ where: { id: categoryId, storeId } });
}

export async function findNameConflict(name, categoryId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.category.findFirst({
    where: { name: name.trim(), id: { not: categoryId }, storeId },
  });
}

export async function updateCategoryService(categoryId, name, file = null, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const data = { name: name.trim() };
  if (file) {
    const iconUrl = await uploadToCloudinary(file);
    data.icon = iconUrl;
  }
  return prisma.category.update({
    where: { id: categoryId, storeId },
    data,
    include: { _count: { select: { products: true } } },
  });
}

export async function deleteCategoryService(categoryId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.category.delete({ where: { id: categoryId, storeId } });
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
