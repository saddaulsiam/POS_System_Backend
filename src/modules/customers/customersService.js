import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function fetchCustomers(where, skip, limit) {
  return prisma.customer.findMany({
    where,
    include: { _count: { select: { sales: true } } },
    orderBy: { name: "asc" },
    skip,
    take: limit,
  });
}

async function countCustomers(countWhere) {
  return prisma.customer.count({ where: countWhere });
}

async function findCustomerByPhone(phone) {
  return prisma.customer.findFirst({
    where: { phoneNumber: phone, isActive: true },
    select: {
      id: true,
      name: true,
      phoneNumber: true,
      email: true,
      address: true,
      loyaltyPoints: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

async function searchCustomers(query) {
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
      loyaltyPoints: true,
    },
    orderBy: { name: "asc" },
    take: 10,
  });
}

async function findCustomerById(customerId) {
  return prisma.customer.findUnique({
    where: { id: customerId, isActive: true },
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

async function aggregateTotalSpent(customerId) {
  return prisma.sale.aggregate({
    where: { customerId, finalAmount: { gt: 0 } },
    _sum: { finalAmount: true },
  });
}

async function findExistingCustomer(phoneNumber, email) {
  return prisma.customer.findFirst({
    where: {
      OR: [...(phoneNumber ? [{ phoneNumber }] : []), ...(email ? [{ email }] : [])],
    },
  });
}

async function createCustomerService(data) {
  return prisma.customer.create({
    data,
    include: { _count: { select: { sales: true } } },
  });
}

async function findCustomerConflict(customerId, phoneNumber, email) {
  return prisma.customer.findFirst({
    where: {
      AND: [
        { id: { not: customerId } },
        {
          OR: [...(phoneNumber ? [{ phoneNumber }] : []), ...(email ? [{ email }] : [])],
        },
      ],
    },
  });
}

async function updateCustomerService(customerId, updateData) {
  return prisma.customer.update({
    where: { id: customerId },
    data: updateData,
    include: { _count: { select: { sales: true } } },
  });
}

async function deactivateCustomerService(customerId) {
  return prisma.customer.update({
    where: { id: customerId },
    data: { isActive: false },
  });
}

async function addLoyaltyPointsService(customerId, points) {
  return prisma.customer.update({
    where: { id: customerId },
    data: { loyaltyPoints: { increment: points } },
  });
}

async function redeemLoyaltyPointsService(customerId, points) {
  return prisma.customer.update({
    where: { id: customerId },
    data: { loyaltyPoints: { decrement: points } },
  });
}

export {
  fetchCustomers,
  countCustomers,
  findCustomerByPhone,
  searchCustomers,
  findCustomerById,
  aggregateTotalSpent,
  findExistingCustomer,
  createCustomerService,
  findCustomerConflict,
  updateCustomerService,
  deactivateCustomerService,
  addLoyaltyPointsService,
  redeemLoyaltyPointsService,
};
