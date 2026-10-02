import prisma from '../../prisma.js';

export class ExpenseService {
  // --- Categories ---
  async getCategories(storeId) {
    return prisma.expenseCategory.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(storeId, data) {
    // Check duplicate
    const existing = await prisma.expenseCategory.findFirst({
      where: { storeId, name: data.name },
    });
    if (existing) {
      throw new Error('Expense category with this name already exists');
    }

    return prisma.expenseCategory.create({
      data: {
        ...data,
        storeId,
      },
    });
  }

  async updateCategory(storeId, id, data) {
    return prisma.expenseCategory.update({
      where: { id, storeId },
      data,
    });
  }

  async deleteCategory(storeId, id) {
    // Check if used
    const count = await prisma.expense.count({
      where: { storeId, categoryId: id },
    });
    if (count > 0) {
      throw new Error('Cannot delete category because it is used by existing expenses');
    }

    return prisma.expenseCategory.delete({
      where: { id, storeId },
    });
  }

  // --- Expenses ---
  async getExpenses(storeId, params) {
    const { page = 1, limit = 50, categoryId, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where = { storeId };

    if (categoryId) {
      where.categoryId = parseInt(categoryId);
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { date: 'desc' },
        include: {
          category: true,
          employee: {
            select: { name: true },
          },
        },
      }),
      prisma.expense.count({ where }),
    ]);

    return { expenses, total, pages: Math.ceil(total / limit) };
  }

  async createExpense(storeId, employeeId, data) {
    return prisma.expense.create({
      data: {
        ...data,
        storeId,
        recordedBy: employeeId,
      },
      include: {
        category: true,
      },
    });
  }

  async updateExpense(storeId, id, data) {
    return prisma.expense.update({
      where: { id, storeId },
      data,
      include: {
        category: true,
      },
    });
  }

  async deleteExpense(storeId, id) {
    return prisma.expense.delete({
      where: { id, storeId },
    });
  }
}

export const expenseService = new ExpenseService();
