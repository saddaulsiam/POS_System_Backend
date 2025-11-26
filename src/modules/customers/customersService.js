import prisma from "../../prisma.js";

async function fetchCustomers(where, skip, limit, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.findMany({
    where: { ...where },
    include: {
      customerStores: {
        where: { storeId },
        select: { loyaltyPoints: true, loyaltyTier: true },
      },
      _count: { select: { sales: true } },
    },
    orderBy: { name: "asc" },
    skip,
    take: limit,
  });
}

async function countCustomers(countWhere, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.count({
    where: {
      ...countWhere,
      customerStores: { some: { storeId } },
    },
  });
}

async function findCustomerByPhone(phone, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.findFirst({
    where: { phoneNumber: phone, isActive: true },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      email: true,
      address: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      customerStores: {
        where: { storeId },
        select: { loyaltyPoints: true, loyaltyTier: true },
      },
    },
  });
}

async function searchCustomers(query, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.findMany({
    where: {
      isActive: true,
      OR: [{ name: { contains: query } }, { phoneNumber: { contains: query } }, { email: { contains: query } }],
    },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      email: true,
      customerStores: {
        where: { storeId },
        select: { loyaltyPoints: true },
      },
    },
    orderBy: { name: "asc" },
    take: 10,
  });
}

async function findCustomerById(customerId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.findFirst({
    where: { id: customerId, isActive: true },
    include: {
      customerStores: {
        where: { storeId },
        select: { loyaltyPoints: true, loyaltyTier: true },
      },
      sales: {
        select: {
          id: true,
          receiptId: true,
          finalAmount: true,
          paymentMethod: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { sales: true } },
    },
  });
}

async function aggregateTotalSpent(customerId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.sale.aggregate({
    where: { customerId, storeId, finalAmount: { gt: 0 } },
    _sum: { finalAmount: true },
  });
}

async function findExistingCustomer(phoneNumber, email, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.findFirst({
    where: {
      customerStores: { some: { storeId } },
      OR: [...(phoneNumber ? [{ phoneNumber }] : []), ...(email ? [{ email }] : [])],
    },
  });
}

async function createCustomerService(data, storeId) {
  // Accepts data and array of storeIds
  const { storeIds, ...customerData } = data;
  if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
    throw new Error("storeIds array is required for multi-store customer creation");
  }
  // Create customer and CustomerStore records
  return prisma.customer.create({
    data: {
      ...customerData,
      customerStores: {
        create: storeIds.map((storeId) => ({ storeId })),
      },
    },
    include: {
      customerStores: true,
      _count: { select: { sales: true } },
    },
  });
}

async function findCustomerConflict(customerId, phoneNumber, email, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.findFirst({
    where: {
      customerStores: { some: { storeId } },
      AND: [
        { id: { not: customerId } },
        {
          OR: [...(phoneNumber ? [{ phoneNumber }] : []), ...(email ? [{ email }] : [])],
        },
      ],
    },
  });
}

async function updateCustomerService(customerId, updateData, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  // Only update if customer belongs to store
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, customerStores: { some: { storeId } } },
  });
  if (!customer) throw new Error("Customer not found in this store");
  return prisma.customer.update({
    where: { id: customerId },
    data: updateData,
    include: { _count: { select: { sales: true } } },
  });
}

async function deactivateCustomerService(customerId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  // Only deactivate if customer belongs to store
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, customerStores: { some: { storeId } } },
  });
  if (!customer) throw new Error("Customer not found in this store");
  return prisma.customer.update({
    where: { id: customerId },
    data: { isActive: false },
  });
}

async function addLoyaltyPointsService(customerId, points, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  // Find CustomerStore record
  const customerStore = await prisma.customerStore.findFirst({ where: { customerId, storeId } });
  if (!customerStore) throw new Error("CustomerStore record not found");
  return prisma.customerStore.update({
    where: { id: customerStore.id },
    data: { loyaltyPoints: { increment: points } },
  });
}

async function redeemLoyaltyPointsService(customerId, points, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  // Find CustomerStore record
  const customerStore = await prisma.customerStore.findFirst({ where: { customerId, storeId } });
  if (!customerStore) throw new Error("CustomerStore record not found");
  return prisma.customerStore.update({
    where: { id: customerStore.id },
    data: { loyaltyPoints: { decrement: points } },
  });
}

export {
  addLoyaltyPointsService,
  aggregateTotalSpent,
  countCustomers,
  createCustomerService,
  deactivateCustomerService,
  fetchCustomers,
  findCustomerById,
  findCustomerByPhone,
  findCustomerConflict,
  findExistingCustomer,
  redeemLoyaltyPointsService,
  searchCustomers,
  updateCustomerService,
};
