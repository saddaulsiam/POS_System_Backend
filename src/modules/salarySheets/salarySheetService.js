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

export async function bulkGenerateSalarySheetsService({ employees, month, year }) {
  const created = [];
  for (const emp of employees) {
    if (typeof emp.salary !== "number" || !emp.salary) continue;
    // Check if salary sheet already exists for this employee/month/year
    const exists = await prisma.salarySheet.findFirst({
      where: { employeeId: emp.id, month, year },
    });
    if (!exists) {
      const sheet = await prisma.salarySheet.create({
        data: {
          employeeId: emp.id,
          month,
          year,
          baseSalary: emp.salary,
          bonus: 0,
          deduction: 0,
        },
      });
      created.push(sheet);
    }
  }
  return { createdCount: created.length, created };
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
