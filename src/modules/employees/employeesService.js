import { PrismaClient } from "@prisma/client";
import cloudinary from "../../utils/cloudinary.js";
import { hashPassword } from "../../utils/helpers.js";
const prisma = new PrismaClient();

export async function getAllEmployeesService({ includeInactive, page = 1, limit = 20 }) {
  const where = includeInactive ? {} : { isActive: true };
  const skip = (page - 1) * limit;
  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        photo: true,
        joinedDate: true,
        salary: true,
        contractDetails: true,
        notes: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
      skip,
      take: limit,
    }),
    prisma.employee.count({ where }),
  ]);
  return {
    data: employees,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getEmployeeByIdService(id) {
  const employeeId = parseInt(id);
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      phone: true,
      photo: true,
      joinedDate: true,
      salary: true,
      contractDetails: true,
      notes: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      sales: {
        select: {
          id: true,
          receiptId: true,
          finalAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
  if (!employee) return null;
  const stats = await prisma.sale.aggregate({
    where: {
      employeeId,
      finalAmount: { gt: 0 },
    },
    _sum: { finalAmount: true },
    _count: true,
  });
  return {
    ...employee,
    stats: {
      totalSales: stats._sum.finalAmount || 0,
      totalTransactions: stats._count,
      averageTransaction: stats._count > 0 ? (stats._sum.finalAmount || 0) / stats._count : 0,
    },
  };
}

export async function createEmployeeService(data) {
  const { name, username, pinCode, role, email, phone, photo, joinedDate, salary, contractDetails, notes } = data;
  const existing = await prisma.employee.findUnique({ where: { username: username.trim() } });
  if (existing) throw new Error("Username already exists");
  const hashedPin = await hashPassword(pinCode);
  return prisma.employee.create({
    data: {
      name: name.trim(),
      username: username.trim(),
      pinCode: hashedPin,
      role,
      email,
      phone,
      photo,
      joinedDate: joinedDate ? new Date(joinedDate) : undefined,
      salary,
      contractDetails,
      notes,
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      phone: true,
      photo: true,
      joinedDate: true,
      salary: true,
      contractDetails: true,
      notes: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function updateEmployeeService(id, data, user) {
  const employeeId = parseInt(id);
  const existingEmployee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!existingEmployee) throw new Error("Employee not found");
  if (data.username) {
    const usernameConflict = await prisma.employee.findFirst({
      where: { username: data.username.trim(), id: { not: employeeId } },
    });
    if (usernameConflict) throw new Error("Username already taken by another employee");
  }
  if (user.id === employeeId && data.isActive === false) {
    throw new Error("Cannot deactivate your own account");
  }
  const updateData = { ...data };
  if (updateData.name) updateData.name = updateData.name.trim();
  if (updateData.username) updateData.username = updateData.username.trim();
  if (updateData.pinCode) {
    updateData.pinCode = await hashPassword(updateData.pinCode);
  }
  if (updateData.joinedDate) updateData.joinedDate = new Date(updateData.joinedDate);
  return prisma.employee.update({
    where: { id: employeeId },
    data: updateData,
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      phone: true,
      photo: true,
      joinedDate: true,
      salary: true,
      contractDetails: true,
      notes: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function resetEmployeePinService(id, newPin) {
  const employeeId = parseInt(id);
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");
  const hashedPin = await hashPassword(newPin);
  await prisma.employee.update({ where: { id: employeeId }, data: { pinCode: hashedPin } });
}

export async function getEmployeePerformanceService(id, startDate, endDate) {
  const employeeId = parseInt(id);
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, name: true, username: true, role: true },
  });
  if (!employee) throw new Error("Employee not found");
  const [salesStats, dailyStats] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        employeeId,
        createdAt: { gte: start, lte: end },
        finalAmount: { gt: 0 },
      },
      _sum: { finalAmount: true, discountAmount: true },
      _count: true,
    }),
    prisma.sale.groupBy({
      by: ["createdAt"],
      where: {
        employeeId,
        createdAt: { gte: start, lte: end },
        finalAmount: { gt: 0 },
      },
      _sum: { finalAmount: true },
      _count: true,
    }),
  ]);
  const dailySales = dailyStats.map((day) => ({
    date: day.createdAt.toISOString().split("T")[0],
    totalSales: day._sum.finalAmount || 0,
    transactions: day._count,
  }));
  return {
    employee,
    period: { startDate: start, endDate: end },
    performance: {
      totalSales: salesStats._sum.finalAmount || 0,
      totalTransactions: salesStats._count,
      totalDiscounts: salesStats._sum.discountAmount || 0,
      averageTransaction: salesStats._count > 0 ? (salesStats._sum.finalAmount || 0) / salesStats._count : 0,
      dailySales,
    },
  };
}

export async function deactivateEmployeeService(id, user) {
  const employeeId = parseInt(id);
  if (user.id === employeeId) throw new Error("Cannot delete your own account");
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");
  await prisma.employee.update({ where: { id: employeeId }, data: { isActive: false } });
}

export async function uploadEmployeePhotoService(id, fileBuffer) {
  const employeeId = parseInt(id);
  if (!fileBuffer) throw new Error("No file buffer provided");
  // Wrap Cloudinary upload_stream in a Promise
  const url = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "employees",
        resource_type: "image",
      },
      async (error, result) => {
        if (error) return reject(error);
        // Update employee photo URL in DB
        await prisma.employee.update({
          where: { id: employeeId },
          data: { photo: result.secure_url },
        });
        resolve(result.secure_url);
      }
    );
    stream.end(fileBuffer);
  });
  return url;
}

// --- Salary Sheet Management ---
export async function getAllSalarySheetsService({ month, year }) {
  const where = {};
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);
  return prisma.salarySheet.findMany({
    where,
    include: { employee: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getEmployeeSalarySheetsService(employeeId) {
  return prisma.salarySheet.findMany({
    where: { employeeId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function createSalarySheetService({ employeeId, month, year, baseSalary, bonus, deduction }) {
  return prisma.salarySheet.create({
    data: { employeeId, month, year, baseSalary, bonus, deduction },
  });
}

export async function updateSalarySheetService(id, { baseSalary, bonus, deduction }) {
  return prisma.salarySheet.update({
    where: { id },
    data: { baseSalary, bonus, deduction },
  });
}

export async function markSalaryAsPaidService(id) {
  return prisma.salarySheet.update({
    where: { id },
    data: { paid: true, paidAt: new Date() },
  });
}

export async function deleteSalarySheetService(id) {
  return prisma.salarySheet.delete({ where: { id } });
}
