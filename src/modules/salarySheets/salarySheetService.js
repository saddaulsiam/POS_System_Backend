import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function getAllSalarySheetsService({ month, year }, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const where = { storeId };
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);
  return prisma.salarySheet.findMany({
    where,
    include: { employee: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getEmployeeSalarySheetsService(employeeId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.salarySheet.findMany({
    where: { employeeId, storeId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function createSalarySheetService({ employeeId, month, year, baseSalary, bonus, deduction }, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.salarySheet.create({
    data: { employeeId, month, year, baseSalary, bonus, deduction, storeId },
  });
}

export async function bulkGenerateSalarySheetsService({ employees, month, year }, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const created = [];
  for (const emp of employees) {
    if (typeof emp.salary !== "number" || !emp.salary) continue;
    // Check if salary sheet already exists for this employee/month/year
    const exists = await prisma.salarySheet.findFirst({
      where: { employeeId: emp.id, month, year, storeId },
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
          storeId,
        },
      });
      created.push(sheet);
    }
  }
  return { createdCount: created.length, created };
}

export async function updateSalarySheetService(id, { baseSalary, bonus, deduction }, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.salarySheet.update({
    where: { id, storeId },
    data: { baseSalary, bonus, deduction },
  });
}

export async function markSalaryAsPaidService(id, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.salarySheet.update({
    where: { id, storeId },
    data: { paid: true, paidAt: new Date() },
  });
}

export async function deleteSalarySheetService(id, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.salarySheet.delete({ where: { id, storeId } });
}
