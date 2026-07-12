import prisma from "../../prisma.js";

async function fetchCustomers(where, skip, limit, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.findMany({
    where: { ...where, storeId },
    include: {
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
    where: { ...countWhere, storeId },
  });
}

async function findCustomerByPhone(phone, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.findFirst({
    where: { phoneNumber: phone, storeId, isActive: true },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      email: true,
      address: true,
      loyaltyPoints: true,
      loyaltyTier: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function searchCustomers(query, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.findMany({
    where: {
      storeId,
      isActive: true,
      OR: [
        { name: { contains: query } },
        { phoneNumber: { contains: query } },
        { email: { contains: query } },
      ],
    },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      email: true,
      loyaltyPoints: true,
      loyaltyTier: true,
    },
    orderBy: { name: "asc" },
    take: 10,
  });
}

async function findCustomerById(customerId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.findFirst({
    where: { id: customerId, storeId, isActive: true },
    include: {
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
      storeId,
      OR: [
        ...(phoneNumber ? [{ phoneNumber }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
  });
}

async function createCustomerService(data, storeId) {
  const { name, phoneNumber, email, dateOfBirth, address } = data;
  return prisma.customer.create({
    data: {
      storeId,
      name,
      phoneNumber: phoneNumber || null,
      email: email || null,
      dateOfBirth: dateOfBirth || null,
      address: address || null,
    },
    include: {
      _count: { select: { sales: true } },
    },
  });
}

async function findCustomerConflict(customerId, phoneNumber, email, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.findFirst({
    where: {
      storeId,
      AND: [
        { id: { not: customerId } },
        {
          OR: [
            ...(phoneNumber ? [{ phoneNumber }] : []),
            ...(email ? [{ email }] : []),
          ],
        },
      ],
    },
  });
}

async function updateCustomerService(customerId, updateData, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId },
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
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, storeId },
  });
  if (!customer) throw new Error("Customer not found in this store");
  return prisma.customer.update({
    where: { id: customerId },
    data: { isActive: false },
  });
}

async function addLoyaltyPointsService(customerId, points, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.update({
    where: { id: customerId },
    data: { loyaltyPoints: { increment: points } },
  });
}

async function redeemLoyaltyPointsService(customerId, points, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.customer.update({
    where: { id: customerId },
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
