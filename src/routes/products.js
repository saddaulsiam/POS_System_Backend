const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");
const { upload, deleteImage } = require("../utils/upload");
const { parseCSV, jsonToCSV, validateProductImport } = require("../utils/csvHandler");
const {
  parseExcel,
  jsonToExcel,
  generateProductImportTemplate,
  validateProductExcelData,
} = require("../utils/excelHandler");
const { generateBarcode, generateBarcodeImage } = require("../utils/barcodeGenerator");
const multer = require("multer");

const router = express.Router();
const prisma = new PrismaClient();
const csvUpload = multer({ storage: multer.memoryStorage() });

// Unified notifications endpoint
router.get("/notifications", authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      include: { product: true },
    });
    res.json({ data: notifications });
  } catch (error) {
    console.error("Fetch notifications error:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.post("/notifications/:id/read", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.notification.update({
      where: { id: parseInt(id) },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});
// Get all products with pagination and filtering
router.get(
  "/",
  [
    authenticateToken,
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 2000 }).withMessage("Limit must be between 1 and 2000"),
    query("search").optional().isString().withMessage("Search must be a string"),
    query("categoryId").optional().isInt().withMessage("Category ID must be an integer"),
    query("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const search = req.query.search;
      const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : undefined;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === "true" : undefined;

      const skip = (page - 1) * limit;

      const where = {};

      if (search) {
        where.OR = [{ name: { contains: search } }, { sku: { contains: search } }, { barcode: { contains: search } }];
      }

      if (categoryId) where.categoryId = categoryId;
      if (isActive !== undefined) where.isActive = isActive;

      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          include: {
            category: true,
            supplier: true,
          },
          orderBy: { name: "asc" },
          skip,
          take: limit,
        }),
        prisma.product.count({ where }),
      ]);

      res.json({
        data: products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get products error:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  }
);

// Get product by ID, SKU, or barcode
router.get("/lookup/:identifier", authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;

    const product = await prisma.product.findFirst({
      where: {
        OR: [{ id: isNaN(identifier) ? -1 : parseInt(identifier) }, { sku: identifier }, { barcode: identifier }],
        isActive: true,
      },
      include: {
        category: true,
        supplier: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("Product lookup error:", error);
    res.status(500).json({ error: "Failed to lookup product" });
  }
});

// Create new product
router.post(
  "/",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("name").notEmpty().withMessage("Product name is required"),
    body("sku").notEmpty().withMessage("SKU is required"),
    body("categoryId").isInt().withMessage("Category ID is required"),
    body("purchasePrice").isFloat({ min: 0 }).withMessage("Purchase price must be a positive number"),
    body("sellingPrice").isFloat({ min: 0 }).withMessage("Selling price must be a positive number"),
    body("stockQuantity").optional().isFloat({ min: 0 }).withMessage("Stock quantity must be non-negative"),
    body("lowStockThreshold").optional().isInt({ min: 0 }).withMessage("Low stock threshold must be non-negative"),
    body("isWeighted").optional().isBoolean().withMessage("isWeighted must be a boolean"),
    body("taxRate").optional().isFloat({ min: 0, max: 100 }).withMessage("Tax rate must be between 0 and 100"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if SKU or barcode already exists
      const existing = await prisma.product.findFirst({
        where: {
          OR: [{ sku: req.body.sku }, ...(req.body.barcode ? [{ barcode: req.body.barcode }] : [])],
        },
      });

      if (existing) {
        return res.status(400).json({
          error: "Product with this SKU or barcode already exists",
        });
      }

      const product = await prisma.product.create({
        data: {
          ...req.body,
          stockQuantity: req.body.stockQuantity || 0,
          lowStockThreshold: req.body.lowStockThreshold || 10,
          isWeighted: req.body.isWeighted || false,
          taxRate: req.body.taxRate || 0,
        },
        include: {
          category: true,
          supplier: true,
        },
      });

      // Generate barcode if not provided
      if (!product.barcode) {
        const barcode = generateBarcode(product.sku, product.id);
        await prisma.product.update({
          where: { id: product.id },
          data: { barcode },
        });
        product.barcode = barcode;
      }

      // Create stock movement record
      if (req.body.stockQuantity > 0) {
        await prisma.stockMovement.create({
          data: {
            productId: product.id,
            movementType: "ADJUSTMENT",
            quantity: req.body.stockQuantity,
            reason: "Initial stock",
            createdBy: req.user.id,
          },
        });
      }

      res.status(201).json(product);
    } catch (error) {
      console.error("Create product error:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  }
);

// Update product
router.put(
  "/:id",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("name").optional().notEmpty().withMessage("Product name cannot be empty"),
    body("purchasePrice").optional().isFloat({ min: 0 }).withMessage("Purchase price must be positive"),
    body("sellingPrice").optional().isFloat({ min: 0 }).withMessage("Selling price must be positive"),
    body("lowStockThreshold").optional().isInt({ min: 0 }).withMessage("Low stock threshold must be non-negative"),
    body("taxRate").optional().isFloat({ min: 0, max: 100 }).withMessage("Tax rate must be between 0 and 100"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const productId = parseInt(id);

      const existingProduct = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Check for SKU/barcode conflicts if they're being updated
      if (req.body.sku || req.body.barcode) {
        const conflicts = await prisma.product.findFirst({
          where: {
            AND: [
              { id: { not: productId } },
              {
                OR: [
                  ...(req.body.sku ? [{ sku: req.body.sku }] : []),
                  ...(req.body.barcode ? [{ barcode: req.body.barcode }] : []),
                ],
              },
            ],
          },
        });

        if (conflicts) {
          return res.status(400).json({
            error: "Another product with this SKU or barcode already exists",
          });
        }
      }

      const product = await prisma.product.update({
        where: { id: productId },
        data: req.body,
        include: {
          category: true,
          supplier: true,
        },
      });

      // Log audit event for product update
      const { logAudit } = require("../utils/helpers");
      logAudit({
        userId: req.user.id,
        action: "UPDATE_PRODUCT",
        entity: "Product",
        entityId: productId,
        details: JSON.stringify(req.body),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"] || "",
      });

      res.json(product);
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  }
);

// Delete product (soft delete)
router.delete("/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });

    // Log audit event for product delete
    const { logAudit } = require("../utils/helpers");
    logAudit({
      userId: req.user.id,
      action: "DELETE_PRODUCT",
      entity: "Product",
      entityId: productId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] || "",
    });

    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Get low stock products
router.get("/alerts/low-stock", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    // First get all products, then filter in JavaScript for now
    const allProducts = await prisma.product.findMany({
      where: {
        isActive: true,
      },
      include: {
        category: true,
        supplier: true,
      },
    });

    // Filter products where stockQuantity <= lowStockThreshold
    const lowStockProducts = allProducts.filter((product) => product.stockQuantity <= product.lowStockThreshold);

    // Sort by stock quantity
    lowStockProducts.sort((a, b) => a.stockQuantity - b.stockQuantity);

    res.json(lowStockProducts);
  } catch (error) {
    console.error("Low stock error:", error);
    res.status(500).json({ error: "Failed to fetch low stock products" });
  }
});

// Upload product image
router.post(
  "/:id/image",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  upload.single("image"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const productId = parseInt(id);

      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // Check if product exists
      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        // Delete uploaded file if product doesn't exist
        deleteImage(req.file.filename);
        return res.status(404).json({ error: "Product not found" });
      }

      // Delete old image if exists
      if (product.image) {
        deleteImage(product.image);
      }

      // Update product with new image path
      const imagePath = `/uploads/products/${req.file.filename}`;
      const updatedProduct = await prisma.product.update({
        where: { id: productId },
        data: { image: imagePath },
        include: {
          category: true,
          supplier: true,
        },
      });

      res.json(updatedProduct);
    } catch (error) {
      console.error("Upload image error:", error);
      // Delete uploaded file on error
      if (req.file) {
        deleteImage(req.file.filename);
      }
      res.status(500).json({ error: "Failed to upload image" });
    }
  }
);

// Delete product image
router.delete("/:id/image", authenticateToken, authorizeRoles("ADMIN", "MANAGER"), async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (!product.image) {
      return res.status(400).json({ error: "Product has no image" });
    }

    // Delete image file
    deleteImage(product.image);

    // Update product to remove image reference
    const updatedProduct = await prisma.product.update({
      where: { id: productId },
      data: { image: null },
      include: {
        category: true,
        supplier: true,
      },
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error("Delete image error:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

// Export products to CSV
router.get("/export", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        supplier: true,
      },
      orderBy: { id: "asc" },
    });

    // Format data for CSV export
    const exportData = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || "",
      categoryId: product.categoryId,
      categoryName: product.category.name,
      supplierId: product.supplierId || "",
      supplierName: product.supplier ? product.supplier.name : "",
      purchasePrice: product.purchasePrice,
      sellingPrice: product.sellingPrice,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: product.lowStockThreshold,
      isActive: product.isActive,
      isWeighted: product.isWeighted,
      taxRate: product.taxRate,
      image: product.image || "",
    }));

    const csv = jsonToCSV(exportData);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="products_export_${Date.now()}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export products" });
  }
});

// Get CSV template for import
router.get("/import/template", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const template = [
      {
        name: "Example Product",
        sku: "EX001",
        categoryId: 1,
        supplierId: "",
        purchasePrice: 10.0,
        sellingPrice: 15.0,
        stockQuantity: 100,
        lowStockThreshold: 10,
        isActive: true,
        isWeighted: false,
        taxRate: 0,
      },
    ];

    const csv = jsonToCSV(template);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="products_import_template.csv"');
    res.send(csv);
  } catch (error) {
    console.error("Template error:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

// Import products from CSV
router.post(
  "/import",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), csvUpload.single("file")],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const csvData = req.file.buffer.toString("utf-8");
      const parseResult = parseCSV(csvData);

      if (parseResult.errors.length > 0) {
        return res.status(400).json({
          error: "Failed to parse CSV",
          details: parseResult.errors,
        });
      }

      const { valid, invalid } = validateProductImport(parseResult.data);

      if (invalid.length > 0 && valid.length === 0) {
        return res.status(400).json({
          error: "All rows have validation errors",
          invalid,
        });
      }

      // Check for duplicate SKUs in the import
      const skus = valid.map((p) => p.sku);
      const duplicateSkus = skus.filter((sku, index) => skus.indexOf(sku) !== index);
      if (duplicateSkus.length > 0) {
        return res.status(400).json({
          error: "Duplicate SKUs found in import file",
          duplicates: [...new Set(duplicateSkus)],
        });
      }

      // Check for existing SKUs in database
      const existingProducts = await prisma.product.findMany({
        where: { sku: { in: skus } },
        select: { sku: true },
      });

      if (existingProducts.length > 0) {
        const existingSkus = existingProducts.map((p) => p.sku);
        return res.status(400).json({
          error: "Some SKUs already exist in the database",
          existingSkus,
        });
      }

      // Verify all category IDs exist
      const categoryIds = [...new Set(valid.map((p) => p.categoryId))];
      const categories = await prisma.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true },
      });

      const validCategoryIds = categories.map((c) => c.id);
      const invalidCategoryIds = categoryIds.filter((id) => !validCategoryIds.includes(id));

      if (invalidCategoryIds.length > 0) {
        return res.status(400).json({
          error: "Some category IDs do not exist",
          invalidCategoryIds,
        });
      }

      // Verify supplier IDs if provided
      const supplierIds = [...new Set(valid.filter((p) => p.supplierId).map((p) => p.supplierId))];
      if (supplierIds.length > 0) {
        const suppliers = await prisma.supplier.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true },
        });

        const validSupplierIds = suppliers.map((s) => s.id);
        const invalidSupplierIds = supplierIds.filter((id) => !validSupplierIds.includes(id));

        if (invalidSupplierIds.length > 0) {
          return res.status(400).json({
            error: "Some supplier IDs do not exist",
            invalidSupplierIds,
          });
        }
      }

      // Import valid products
      const imported = await prisma.product.createMany({
        data: valid,
      });

      // Generate barcodes for imported products
      const importedProducts = await prisma.product.findMany({
        orderBy: { id: "desc" },
        take: imported.count,
      });

      for (const product of importedProducts) {
        if (!product.barcode) {
          const barcode = generateBarcode(product.sku, product.id);
          await prisma.product.update({
            where: { id: product.id },
            data: { barcode },
          });
        }
      }

      res.json({
        message: "Products imported successfully",
        imported: imported.count,
        skipped: invalid.length,
        invalid: invalid.length > 0 ? invalid : undefined,
      });
    } catch (error) {
      console.error("Import error:", error);
      res.status(500).json({ error: "Failed to import products", details: error.message });
    }
  }
);

// Export products to Excel
router.get("/export/excel", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: {
        category: true,
        supplier: true,
      },
      orderBy: { name: "asc" },
    });

    const exportData = products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || "",
      description: p.description || "",
      categoryId: p.categoryId,
      categoryName: p.category.name,
      supplierId: p.supplierId || "",
      supplierName: p.supplier?.name || "",
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      isWeighted: p.isWeighted,
      isActive: p.isActive,
      taxRate: p.taxRate,
      unit: p.unit || "pcs",
      hasVariants: p.hasVariants,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    const buffer = jsonToExcel(exportData, "Products");

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="products_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    console.error("Export Excel error:", error);
    res.status(500).json({ error: "Failed to export products to Excel" });
  }
});

// Download Excel import template
router.get("/import/excel/template", [authenticateToken], async (req, res) => {
  try {
    const buffer = generateProductImportTemplate();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=product_import_template.xlsx");
    res.send(buffer);
  } catch (error) {
    console.error("Template generation error:", error);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

// Import products from Excel
router.post(
  "/import/excel",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), csvUpload.single("file")],
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const result = parseExcel(req.file.buffer);
      if (result.errors.length > 0) {
        return res.status(400).json({ error: "Invalid Excel file", details: result.errors });
      }

      const { valid, invalid } = validateProductExcelData(result.data);

      if (valid.length === 0) {
        return res.status(400).json({
          error: "No valid products found",
          invalid,
        });
      }

      // Check for duplicate SKUs in database
      const skus = valid.map((p) => p.sku);
      const existingProducts = await prisma.product.findMany({
        where: { sku: { in: skus } },
        select: { sku: true },
      });

      const existingSKUs = new Set(existingProducts.map((p) => p.sku));
      const productsToImport = valid.filter((p) => !existingSKUs.has(p.sku));
      const duplicates = valid.filter((p) => existingSKUs.has(p.sku));

      if (productsToImport.length === 0) {
        return res.status(400).json({
          error: "All products already exist (duplicate SKUs)",
          duplicates: duplicates.length,
        });
      }

      // Import products
      const imported = await prisma.product.createMany({
        data: productsToImport,
        skipDuplicates: true,
      });

      // Generate barcodes for products without them
      const importedProducts = await prisma.product.findMany({
        where: { sku: { in: productsToImport.map((p) => p.sku) } },
      });

      for (const product of importedProducts) {
        if (!product.barcode) {
          const barcode = generateBarcode(product.sku, product.id);
          await prisma.product.update({
            where: { id: product.id },
            data: { barcode },
          });
        }
      }

      res.json({
        message: "Products imported successfully from Excel",
        imported: imported.count,
        duplicates: duplicates.length,
        invalid: invalid.length,
        invalidDetails: invalid.length > 0 ? invalid : undefined,
      });
    } catch (error) {
      console.error("Excel import error:", error);
      res.status(500).json({ error: "Failed to import Excel file", details: error.message });
    }
  }
);

// Generate barcode image for a product (public endpoint - no auth required for img tags)
router.get("/:id/barcode", async (req, res) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (!product.barcode) {
      return res.status(400).json({ error: "Product has no barcode" });
    }

    const barcodeImage = await generateBarcodeImage(product.barcode);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `inline; filename="barcode_${product.sku}.png"`);
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    res.send(barcodeImage);
  } catch (error) {
    console.error("Barcode generation error:", error);
    res.status(500).json({ error: "Failed to generate barcode image", details: error.message });
  }
});

// Regenerate barcode for a product
router.post("/:id/barcode/regenerate", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
      include: {
        category: true,
        supplier: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const barcode = generateBarcode(product.sku, product.id);
    const updatedProduct = await prisma.product.update({
      where: { id: product.id },
      data: { barcode },
      include: {
        category: true,
        supplier: true,
      },
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error("Regenerate barcode error:", error);
    res.status(500).json({ error: "Failed to regenerate barcode" });
  }
});

// Get product by ID (must be last to avoid conflicts with other routes)
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return res.status(400).json({ error: "Invalid product ID" });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        supplier: true,
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("Get product by ID error:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

module.exports = router;
