const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/suppliers
 * @desc    Get all suppliers with optional search and pagination
 * @access  Admin, Manager
 */
router.get("/", authorizeRoles("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause for search
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { contactName: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    // Get total count for pagination
    const totalItems = await prisma.supplier.count({ where });

    // Get suppliers with product count
    const suppliers = await prisma.supplier.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    // Transform response to include product count
    const suppliersWithCount = suppliers.map((supplier) => ({
      id: supplier.id,
      name: supplier.name,
      contactName: supplier.contactName,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      productCount: supplier._count.products,
      createdAt: supplier.createdAt,
      updatedAt: supplier.updatedAt,
    }));

    res.json({
      data: suppliersWithCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        totalItems,
        hasNextPage: skip + parseInt(limit) < totalItems,
        hasPreviousPage: parseInt(page) > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});

/**
 * @route   GET /api/suppliers/:id
 * @desc    Get supplier by ID with products
 * @access  Admin, Manager
 */
router.get("/:id", authorizeRoles("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id) },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            sku: true,
            stockQuantity: true,
            sellingPrice: true,
            isActive: true,
          },
        },
        _count: {
          select: { products: true, PurchaseOrder: true },
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    res.json({
      ...supplier,
      productCount: supplier._count.products,
      purchaseOrderCount: supplier._count.PurchaseOrder,
    });
  } catch (error) {
    console.error("Error fetching supplier:", error);
    res.status(500).json({ error: "Failed to fetch supplier" });
  }
});

/**
 * @route   POST /api/suppliers
 * @desc    Create a new supplier
 * @access  Admin, Manager
 */
router.post("/", authorizeRoles("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { name, contactName, phone, email, address } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Supplier name is required" });
    }

    // Check for duplicate phone or email if provided
    if (phone) {
      const existingSupplier = await prisma.supplier.findFirst({
        where: { phone },
      });
      if (existingSupplier) {
        return res.status(400).json({ error: "A supplier with this phone number already exists" });
      }
    }

    if (email) {
      const existingSupplier = await prisma.supplier.findFirst({
        where: { email },
      });
      if (existingSupplier) {
        return res.status(400).json({ error: "A supplier with this email already exists" });
      }
    }

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        contactName: contactName?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
      },
    });

    res.status(201).json(supplier);
  } catch (error) {
    console.error("Error creating supplier:", error);
    res.status(500).json({ error: "Failed to create supplier" });
  }
});

/**
 * @route   PUT /api/suppliers/:id
 * @desc    Update supplier
 * @access  Admin, Manager
 */
router.put("/:id", authorizeRoles("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, contactName, phone, email, address } = req.body;

    // Check if supplier exists
    const existingSupplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingSupplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    // Validate name if provided
    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: "Supplier name cannot be empty" });
    }

    // Check for duplicate phone (excluding current supplier)
    if (phone) {
      const duplicatePhone = await prisma.supplier.findFirst({
        where: {
          phone,
          id: { not: parseInt(id) },
        },
      });
      if (duplicatePhone) {
        return res.status(400).json({ error: "A supplier with this phone number already exists" });
      }
    }

    // Check for duplicate email (excluding current supplier)
    if (email) {
      const duplicateEmail = await prisma.supplier.findFirst({
        where: {
          email,
          id: { not: parseInt(id) },
        },
      });
      if (duplicateEmail) {
        return res.status(400).json({ error: "A supplier with this email already exists" });
      }
    }

    const supplier = await prisma.supplier.update({
      where: { id: parseInt(id) },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(contactName !== undefined && { contactName: contactName?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
      },
    });

    res.json(supplier);
  } catch (error) {
    console.error("Error updating supplier:", error);
    res.status(500).json({ error: "Failed to update supplier" });
  }
});

/**
 * @route   DELETE /api/suppliers/:id
 * @desc    Delete supplier (only if no products associated)
 * @access  Admin
 */
router.delete("/:id", authorizeRoles("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!supplier) {
      return res.status(404).json({ error: "Supplier not found" });
    }

    // Prevent deletion if supplier has products
    if (supplier._count.products > 0) {
      return res.status(400).json({
        error: `Cannot delete supplier. ${supplier._count.products} product(s) are associated with this supplier.`,
      });
    }

    await prisma.supplier.delete({
      where: { id: parseInt(id) },
    });

    res.json({ message: "Supplier deleted successfully" });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    res.status(500).json({ error: "Failed to delete supplier" });
  }
});

module.exports = router;
