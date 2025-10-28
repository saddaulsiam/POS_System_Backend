// Salary Sheet Service (migrated from employees module)

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function getAllSalarySheetsService({ month, year }) {
  const where = {};
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);
  if (where.employeeId !== undefined) {
    delete where.employeeId;
  }
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
