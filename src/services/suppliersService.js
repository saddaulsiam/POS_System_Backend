import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const getSuppliersService = async (query) => {
  const { page = 1, limit = 50, search } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { contactName: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
        ],
      }
    : {};
  const totalItems = await prisma.supplier.count({ where });
  const suppliers = await prisma.supplier.findMany({
    where,
    skip,
    take: parseInt(limit),
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });
  const suppliersWithCount = suppliers.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    contactName: supplier.contactName,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    productCount: supplier._count.products,
    createdAt: supplier.createdAt,
    updatedAt: supplier.updatedAt,
  }));
  return {
    data: suppliersWithCount,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalItems / parseInt(limit)),
      totalItems,
      hasNextPage: skip + parseInt(limit) < totalItems,
      hasPreviousPage: parseInt(page) > 1,
    },
  };
};

export const getSupplierByIdService = async (id) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: parseInt(id) },
    include: {
      products: {
        select: {
          id: true,
          name: true,
          sku: true,
          stockQuantity: true,
          sellingPrice: true,
          isActive: true,
        },
      },
      _count: {
        select: { products: true, PurchaseOrder: true },
      },
    },
  });
  if (!supplier) return null;
  return {
    ...supplier,
    productCount: supplier._count.products,
    purchaseOrderCount: supplier._count.PurchaseOrder,
  };
};

export const createSupplierService = async (body) => {
  const { name, contactName, phone, email, address } = body;
  if (!name || !name.trim()) {
    throw new Error("Supplier name is required");
  }
  if (phone) {
    const existingSupplier = await prisma.supplier.findFirst({ where: { phone } });
    if (existingSupplier) {
      throw new Error("A supplier with this phone number already exists");
    }
  }
  if (email) {
    const existingSupplier = await prisma.supplier.findFirst({ where: { email } });
    if (existingSupplier) {
      throw new Error("A supplier with this email already exists");
    }
  }
  return prisma.supplier.create({
    data: {
      name: name.trim(),
      contactName: contactName?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      address: address?.trim() || null,
    },
  });
};

export const updateSupplierService = async (id, body) => {
  const { name, contactName, phone, email, address } = body;
  const existingSupplier = await prisma.supplier.findUnique({ where: { id: parseInt(id) } });
  if (!existingSupplier) {
    throw new Error("Supplier not found");
  }
  if (name !== undefined && (!name || !name.trim())) {
    throw new Error("Supplier name cannot be empty");
  }
  if (phone) {
    const duplicatePhone = await prisma.supplier.findFirst({
      where: {
        phone,
        id: { not: parseInt(id) },
      },
    });
    if (duplicatePhone) {
      throw new Error("A supplier with this phone number already exists");
    }
  }
  if (email) {
    const duplicateEmail = await prisma.supplier.findFirst({
      where: {
        email,
        id: { not: parseInt(id) },
      },
    });
    if (duplicateEmail) {
      throw new Error("A supplier with this email already exists");
    }
  }
  return prisma.supplier.update({
    where: { id: parseInt(id) },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...(contactName !== undefined && { contactName: contactName?.trim() || null }),
      ...(phone !== undefined && { phone: phone?.trim() || null }),
      ...(email !== undefined && { email: email?.trim() || null }),
      ...(address !== undefined && { address: address?.trim() || null }),
    },
  });
};

export const deleteSupplierService = async (id) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: parseInt(id) },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });
  if (!supplier) {
    throw new Error("Supplier not found");
  }
  if (supplier._count.products > 0) {
    throw new Error(
      `Cannot delete supplier. ${supplier._count.products} product(s) are associated with this supplier.`
    );
  }
  await prisma.supplier.delete({ where: { id: parseInt(id) } });
  return { message: "Supplier deleted successfully" };
};
