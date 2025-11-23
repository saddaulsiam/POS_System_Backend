import prisma from "../../prisma.js";

export async function getAllSalarySheetsService({ month, year }, storeId) {
  if (!storeId) {
    throw new Error(
      "Access denied: storeId is required for salary sheet operations. Please contact your administrator."
    );
  }
  // Find all employees for this store
  const employees = await prisma.employee.findMany({ where: { storeId }, select: { id: true } });
  const employeeIds = employees.map((e) => e.id);
  const where = { employeeId: { in: employeeIds } };
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);
  return prisma.salarySheet.findMany({
    where,
    include: { employee: true },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function getEmployeeSalarySheetsService(employeeId, storeId) {
  if (!storeId) {
    throw new Error(
      "Access denied: storeId is required for salary sheet operations. Please contact your administrator."
    );
  }
  // Validate employee belongs to store
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.storeId !== storeId) throw new Error("Employee does not belong to this store");
  return prisma.salarySheet.findMany({
    where: { employeeId },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });
}

export async function createSalarySheetService({ employeeId, month, year, baseSalary, bonus, deduction }, storeId) {
  if (!storeId) {
    throw new Error(
      "Access denied: storeId is required for salary sheet operations. Please contact your administrator."
    );
  }
  // Validate employee belongs to store
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.storeId !== storeId) throw new Error("Employee does not belong to this store");
  return prisma.salarySheet.create({
    data: { employeeId, month, year, baseSalary, bonus, deduction },
  });
}

export async function bulkGenerateSalarySheetsService({ employees, month, year }, storeId) {
  if (!storeId) {
    throw new Error(
      "Access denied: storeId is required for salary sheet operations. Please contact your administrator."
    );
  }
  const created = [];
  for (const emp of employees) {
    if (typeof emp.salary !== "number" || !emp.salary) {
      continue;
    }
    if (emp.storeId !== storeId) {
      continue;
    }
    // Check if salary sheet already exists for this employee/month/year
    const exists = await prisma.salarySheet.findFirst({
      where: { employeeId: emp.id, month, year },
    });
    if (exists) {
      continue;
    }
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
  return { createdCount: created.length, created };
}

export async function updateSalarySheetService(id, { baseSalary, bonus, deduction }, storeId) {
  if (!storeId) {
    throw new Error(
      "Access denied: storeId is required for salary sheet operations. Please contact your administrator."
    );
  }
  // Validate salary sheet belongs to an employee in this store
  const sheet = await prisma.salarySheet.findUnique({ where: { id } });
  if (!sheet) throw new Error("Salary sheet not found");
  const employee = await prisma.employee.findUnique({ where: { id: sheet.employeeId } });
  if (!employee || employee.storeId !== storeId) throw new Error("Employee does not belong to this store");
  return prisma.salarySheet.update({
    where: { id },
    data: { baseSalary, bonus, deduction },
  });
}

export async function markSalaryAsPaidService(id, storeId) {
  if (!storeId) {
    throw new Error(
      "Access denied: storeId is required for salary sheet operations. Please contact your administrator."
    );
  }
  // Validate salary sheet belongs to an employee in this store
  const sheet = await prisma.salarySheet.findUnique({ where: { id } });
  if (!sheet) throw new Error("Salary sheet not found");
  const employee = await prisma.employee.findUnique({ where: { id: sheet.employeeId } });
  if (!employee || employee.storeId !== storeId) throw new Error("Employee does not belong to this store");
  return prisma.salarySheet.update({
    where: { id },
    data: { paid: true, paidAt: new Date() },
  });
}

export async function deleteSalarySheetService(id, storeId) {
  if (!storeId) {
    throw new Error(
      "Access denied: storeId is required for salary sheet operations. Please contact your administrator."
    );
  }
  // Validate salary sheet belongs to an employee in this store
  const sheet = await prisma.salarySheet.findUnique({ where: { id } });
  if (!sheet) throw new Error("Salary sheet not found");
  const employee = await prisma.employee.findUnique({ where: { id: sheet.employeeId } });
  if (!employee || employee.storeId !== storeId) throw new Error("Employee does not belong to this store");
  return prisma.salarySheet.delete({ where: { id } });
}
