import prisma from "../../prisma.js";
import cloudinary from "../../utils/cloudinary.js";

export async function fetchBrands(storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.brand.findMany({
    where: { storeId },
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });
}

export async function fetchBrandById(brandId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.brand.findFirst({
    where: { id: brandId, storeId },
    include: {
      products: { where: { isActive: true }, orderBy: { name: "asc" } },
      _count: { select: { products: true } },
    },
  });
}

export async function createBrandService(name, file = null, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  let iconUrl = null;
  if (file) {
    iconUrl = await uploadToCloudinary(file);
  }
  return prisma.brand.create({
    data: { name: name.trim(), icon: iconUrl, storeId },
    include: { _count: { select: { products: true } } },
  });
}

export async function findBrandByName(name, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.brand.findFirst({ where: { name: name.trim(), storeId } });
}

export async function findBrandById(brandId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.brand.findFirst({ where: { id: brandId, storeId } });
}

export async function findNameConflict(name, brandId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.brand.findFirst({
    where: { name: name.trim(), id: { not: brandId }, storeId },
  });
}

export async function updateBrandService(brandId, name, file = null, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const data = { name: name.trim() };
  if (file) {
    const iconUrl = await uploadToCloudinary(file);
    data.icon = iconUrl;
  }
  return prisma.brand.update({
    where: { id: brandId, storeId },
    data,
    include: { _count: { select: { products: true } } },
  });
}

export async function deleteBrandService(brandId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.brand.delete({ where: { id: brandId, storeId } });
}

// Helper function to upload to Cloudinary
async function uploadToCloudinary(file) {
  let iconUrl = null;

  if (file.buffer) {
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "pos/brands", resource_type: "image" },
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
    try {
      const res = await cloudinary.uploader.upload(file.path, {
        folder: "pos/brands",
        resource_type: "image",
      });
      iconUrl = res.secure_url;
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      throw new Error("Failed to upload icon to Cloudinary");
    }
  }
  return iconUrl;
}
