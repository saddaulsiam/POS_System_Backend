const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { generateReceiptId, calculateTax } = require("../utils/helpers");

// Get all sales with pagination and filtering
async function getSales(req, res) {
  try {
    const errors = req.validationResult ? req.validationResult() : [];
    if (errors && errors.length > 0) {
      return res.status(400).json({ errors });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const where = {};
    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) where.createdAt.gte = new Date(req.query.startDate);
      if (req.query.endDate) where.createdAt.lte = new Date(req.query.endDate);
    }
    if (req.query.employeeId) where.employeeId = parseInt(req.query.employeeId);
    if (req.query.customerId) where.customerId = parseInt(req.query.customerId);
    if (req.query.paymentMethod) where.paymentMethod = req.query.paymentMethod;
    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true, username: true } },
          customer: { select: { id: true, name: true, phoneNumber: true } },
          saleItems: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
              productVariant: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);
    res.json({
      data: sales,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get sales error:", error);
    res.status(500).json({ error: "Failed to fetch sales" });
  }
}

module.exports = {
  getSales,
  // Add other sales controller functions here
};
