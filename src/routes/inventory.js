const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const { authenticateToken, authorizeRoles } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// Get stock movements with filtering
router.get(
  "/movements",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("productId").optional().isInt().withMessage("Product ID must be an integer"),
    query("movementType").optional().isString().withMessage("Movement type must be a string"),
    query("startDate").optional().isISO8601().withMessage("Start date must be valid ISO date"),
    query("endDate").optional().isISO8601().withMessage("End date must be valid ISO date"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 50;
      const skip = (page - 1) * limit;

      const where = {};

      if (req.query.productId) where.productId = parseInt(req.query.productId);
      if (req.query.movementType) where.movementType = req.query.movementType;
      if (req.query.startDate || req.query.endDate) {
        where.createdAt = {};
        if (req.query.startDate) where.createdAt.gte = new Date(req.query.startDate);
        if (req.query.endDate) where.createdAt.lte = new Date(req.query.endDate);
      }

      const [movements, total] = await Promise.all([
        prisma.stockMovement.findMany({
          where,
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.stockMovement.count({ where }),
      ]);

      res.json({
        movements,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Get stock movements error:", error);
      res.status(500).json({ error: "Failed to fetch stock movements" });
    }
  }
);

// Create stock adjustment
router.post(
  "/adjust",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("productId").isInt().withMessage("Product ID is required"),
    body("quantity").isFloat().withMessage("Quantity is required"),
    body("movementType")
      .isString()
      .isIn(["PURCHASE", "ADJUSTMENT", "RETURN", "DAMAGED", "EXPIRED"])
      .withMessage("Invalid movement type"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, quantity, movementType, reason } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({
          where: { id: productId },
        });

        if (!product) {
          throw new Error("Product not found");
        }

        // Update stock
        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { stockQuantity: { increment: quantity } },
        });

        // Create stock movement
        const movement = await tx.stockMovement.create({
          data: {
            productId,
            movementType,
            quantity,
            reason: reason || "Manual stock adjustment",
            createdBy: req.user.id,
          },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
          },
        });

        return { movement, updatedStock: updatedProduct.stockQuantity };
      });

      res.json(result);
    } catch (error) {
      console.error("Stock adjustment error:", error);
      res.status(500).json({ error: error.message || "Failed to adjust stock" });
    }
  }
);

// Get low stock alert
router.get("/alerts/low-stock", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    // Note: This is a workaround since Prisma doesn't support field comparison directly
    const lowStockProducts = await prisma.$queryRaw`
      SELECT p.*, c.name as categoryName 
      FROM Product p 
      LEFT JOIN Category c ON p.categoryId = c.id 
      WHERE p.isActive = 1 AND p.stockQuantity <= p.lowStockThreshold 
      ORDER BY p.stockQuantity ASC
    `;

    res.json(lowStockProducts);
  } catch (error) {
    console.error("Low stock alert error:", error);
    res.status(500).json({ error: "Failed to fetch low stock alerts" });
  }
});

// Get inventory summary
router.get("/summary", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const [totalProducts, totalValue, lowStockCount] = await Promise.all([
      prisma.product.count({
        where: { isActive: true },
      }),
      prisma.product.aggregate({
        where: { isActive: true },
        _sum: {
          stockQuantity: true,
        },
      }),
      prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM Product 
        WHERE isActive = 1 AND stockQuantity <= lowStockThreshold
      `,
    ]);

    const totalStockValue = await prisma.product.aggregate({
      where: { isActive: true },
      _sum: {
        stockQuantity: true,
      },
    });

    // Calculate total inventory value
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { stockQuantity: true, purchasePrice: true },
    });

    const totalInventoryValue = products.reduce((sum, product) => {
      return sum + product.stockQuantity * product.purchasePrice;
    }, 0);

    res.json({
      totalProducts,
      totalItems: totalValue._sum.stockQuantity || 0,
      totalInventoryValue,
      lowStockProducts: lowStockCount[0]?.count || 0,
    });
  } catch (error) {
    console.error("Inventory summary error:", error);
    res.status(500).json({ error: "Failed to generate inventory summary" });
  }
});

// Bulk stock update (from CSV or manual input)
router.post(
  "/bulk-update",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("updates").isArray({ min: 1 }).withMessage("Updates array is required"),
    body("updates.*.productId").isInt().withMessage("Product ID is required for each update"),
    body("updates.*.newQuantity").isFloat({ min: 0 }).withMessage("New quantity must be non-negative"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { updates, reason } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        const results = [];

        for (const update of updates) {
          const product = await tx.product.findUnique({
            where: { id: update.productId },
          });

          if (!product) {
            throw new Error(`Product with ID ${update.productId} not found`);
          }

          const quantityDifference = update.newQuantity - product.stockQuantity;

          // Update stock
          const updatedProduct = await tx.product.update({
            where: { id: update.productId },
            data: { stockQuantity: update.newQuantity },
          });

          // Create stock movement if there's a change
          if (quantityDifference !== 0) {
            await tx.stockMovement.create({
              data: {
                productId: update.productId,
                movementType: "ADJUSTMENT",
                quantity: quantityDifference,
                reason: reason || "Bulk stock update",
                createdBy: req.user.id,
              },
            });
          }

          results.push({
            productId: update.productId,
            productName: product.name,
            oldQuantity: product.stockQuantity,
            newQuantity: update.newQuantity,
            difference: quantityDifference,
          });
        }

        return results;
      });

      res.json({
        message: `Updated stock for ${result.length} products`,
        updates: result,
      });
    } catch (error) {
      console.error("Bulk stock update error:", error);
      res.status(500).json({ error: error.message || "Failed to update stock" });
    }
  }
);

// Stock adjustment (damage, expiry, loss, found)
router.post(
  "/adjust",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("productId").isInt().withMessage("Product ID is required"),
    body("productVariantId").optional().isInt(),
    body("quantity").isFloat().withMessage("Quantity is required"),
    body("reason").isIn(["DAMAGED", "EXPIRED", "LOST", "FOUND", "COUNT_ADJUSTMENT"]).withMessage("Invalid reason"),
    body("notes").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, productVariantId, quantity, reason, notes } = req.body;
      const employeeId = req.user.id;

      const result = await prisma.$transaction(async (tx) => {
        // Update stock
        if (productVariantId) {
          await tx.productVariant.update({
            where: { id: productVariantId },
            data: { stockQuantity: { increment: quantity } },
          });
        } else {
          await tx.product.update({
            where: { id: productId },
            data: { stockQuantity: { increment: quantity } },
          });
        }

        // Create stock movement
        const movement = await tx.stockMovement.create({
          data: {
            productId,
            productVariantId,
            movementType: "ADJUSTMENT",
            quantity,
            reason,
            reference: notes || `Adjustment: ${reason}`,
            createdBy: employeeId,
          },
          include: {
            product: {
              select: { id: true, name: true, sku: true, stockQuantity: true },
            },
            productVariant: {
              select: { id: true, name: true, stockQuantity: true },
            },
          },
        });

        // Create alert if stock is now low
        if (!productVariantId) {
          const product = await tx.product.findUnique({ where: { id: productId } });
          if (product.stockQuantity <= product.lowStockThreshold) {
            await tx.stockAlert.create({
              data: {
                productId,
                alertType: product.stockQuantity === 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
                message: `${product.name} stock is ${product.stockQuantity === 0 ? "out of stock" : "low"}`,
              },
            });
          }
        }

        return movement;
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Stock adjustment error:", error);
      res.status(500).json({ error: error.message || "Failed to adjust stock" });
    }
  }
);

// Stock transfer between locations
router.post(
  "/transfer",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("productId").isInt().withMessage("Product ID is required"),
    body("productVariantId").optional().isInt(),
    body("quantity").isFloat({ min: 0.01 }).withMessage("Quantity must be positive"),
    body("fromLocation").notEmpty().withMessage("From location is required"),
    body("toLocation").notEmpty().withMessage("To location is required"),
    body("notes").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { productId, productVariantId, quantity, fromLocation, toLocation, notes } = req.body;
      const employeeId = req.user.id;

      // Create transfer reference ID
      const transferId = `TR-${Date.now()}`;

      const result = await prisma.$transaction(async (tx) => {
        // Deduct from source location
        const outMovement = await tx.stockMovement.create({
          data: {
            productId,
            productVariantId,
            movementType: "TRANSFER",
            quantity: -quantity,
            reason: `Transfer to ${toLocation}`,
            reference: transferId,
            fromLocation,
            toLocation,
            createdBy: employeeId,
          },
        });

        // Add to destination location
        const inMovement = await tx.stockMovement.create({
          data: {
            productId,
            productVariantId,
            movementType: "TRANSFER",
            quantity: quantity,
            reason: `Transfer from ${fromLocation}`,
            reference: transferId,
            fromLocation,
            toLocation,
            createdBy: employeeId,
          },
          include: {
            product: {
              select: { id: true, name: true, sku: true },
            },
            productVariant: {
              select: { id: true, name: true },
            },
          },
        });

        return {
          transferId,
          outMovement,
          inMovement,
        };
      });

      res.status(201).json(result);
    } catch (error) {
      console.error("Stock transfer error:", error);
      res.status(500).json({ error: error.message || "Failed to transfer stock" });
    }
  }
);

// Get stock alerts
router.get(
  "/alerts",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), query("isResolved").optional().isBoolean()],
  async (req, res) => {
    try {
      const where = {};
      if (req.query.isResolved !== undefined) {
        where.isResolved = req.query.isResolved === "true";
      }

      const alerts = await prisma.stockAlert.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              stockQuantity: true,
              lowStockThreshold: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json(alerts);
    } catch (error) {
      console.error("Get alerts error:", error);
      res.status(500).json({ error: "Failed to fetch stock alerts" });
    }
  }
);

// Resolve stock alert
router.put("/alerts/:id/resolve", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const employeeId = req.user.id;

    const alert = await prisma.stockAlert.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy: employeeId,
      },
      include: {
        product: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(alert);
  } catch (error) {
    console.error("Resolve alert error:", error);
    res.status(500).json({ error: "Failed to resolve alert" });
  }
});

// Receive purchase order
router.post(
  "/receive-purchase-order",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("purchaseOrderId").isInt().withMessage("Purchase order ID is required"),
    body("items").isArray({ min: 1 }).withMessage("Items array required"),
    body("items.*.productId").isInt(),
    body("items.*.receivedQuantity").isFloat({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { purchaseOrderId, items } = req.body;
      const employeeId = req.user.id;

      const result = await prisma.$transaction(async (tx) => {
        const po = await tx.purchaseOrder.findUnique({
          where: { id: purchaseOrderId },
          include: { items: true },
        });

        if (!po) {
          throw new Error("Purchase order not found");
        }

        // Update each item
        for (const receivedItem of items) {
          const poItem = po.items.find((i) => i.productId === receivedItem.productId);
          if (!poItem) continue;

          // Update PO item
          await tx.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: {
              receivedQuantity: { increment: receivedItem.receivedQuantity },
            },
          });

          // Update product stock
          await tx.product.update({
            where: { id: receivedItem.productId },
            data: {
              stockQuantity: { increment: receivedItem.receivedQuantity },
            },
          });

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId: receivedItem.productId,
              movementType: "PURCHASE",
              quantity: receivedItem.receivedQuantity,
              reason: "Purchase order received",
              reference: po.poNumber,
              createdBy: employeeId,
            },
          });
        }

        // Check if PO is fully received
        const updatedPO = await tx.purchaseOrder.findUnique({
          where: { id: purchaseOrderId },
          include: { items: true },
        });

        const allReceived = updatedPO.items.every((item) => item.receivedQuantity >= item.quantity);
        const partiallyReceived = updatedPO.items.some((item) => item.receivedQuantity > 0);

        const newStatus = allReceived ? "RECEIVED" : partiallyReceived ? "PARTIALLY_RECEIVED" : "ORDERED";

        // Update PO status
        const finalPO = await tx.purchaseOrder.update({
          where: { id: purchaseOrderId },
          data: {
            status: newStatus,
            receivedDate: allReceived ? new Date() : null,
          },
          include: {
            supplier: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        return finalPO;
      });

      res.json(result);
    } catch (error) {
      console.error("Receive PO error:", error);
      res.status(500).json({ error: error.message || "Failed to receive purchase order" });
    }
  }
);

// Get all purchase orders
router.get("/purchase-orders", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { page = 1, limit = 20, status, supplierId, startDate, endDate } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};

    if (status) {
      where.status = status;
    }

    if (supplierId) {
      where.supplierId = parseInt(supplierId);
    }

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) {
        where.orderDate.gte = new Date(startDate);
      }
      if (endDate) {
        where.orderDate.lte = new Date(endDate);
      }
    }

    const [purchaseOrders, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              contactName: true,
              email: true,
              phone: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    res.json({
      purchaseOrders,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        pages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Error fetching purchase orders:", error);
    res.status(500).json({ error: "Failed to fetch purchase orders" });
  }
});

// Get purchase order by ID
router.get("/purchase-orders/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            contactName: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                barcode: true,
              },
            },
          },
        },
      },
    });

    if (!purchaseOrder) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    res.json(purchaseOrder);
  } catch (error) {
    console.error("Error fetching purchase order:", error);
    res.status(500).json({ error: "Failed to fetch purchase order" });
  }
});

// Create purchase order
router.post(
  "/purchase-orders",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("supplierId").isInt().withMessage("Supplier ID is required"),
    body("orderDate").isISO8601().withMessage("Order date must be valid"),
    body("expectedDate").optional().isISO8601().withMessage("Expected date must be valid"),
    body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
    body("items.*.productId").isInt().withMessage("Product ID is required"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("items.*.unitPrice").isFloat({ min: 0 }).withMessage("Unit price must be valid"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { supplierId, orderDate, expectedDate, items, notes } = req.body;
      const employeeId = req.user.id;

      console.log("Creating PO with data:", { supplierId, orderDate, expectedDate, items, notes, employeeId });

      // Generate unique PO number
      const poCount = await prisma.purchaseOrder.count();
      const poNumber = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(5, "0")}`;

      // Calculate total amount
      const totalAmount = items.reduce((sum, item) => {
        return sum + item.quantity * item.unitPrice;
      }, 0);

      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: parseInt(supplierId),
          orderDate: new Date(orderDate),
          expectedDate: expectedDate ? new Date(expectedDate) : null,
          status: "PENDING",
          totalAmount,
          notes: notes || null,
          items: {
            create: items.map((item) => {
              const unitCost = parseFloat(item.unitPrice);
              const quantity = parseFloat(item.quantity);
              return {
                productId: item.productId,
                quantity: quantity,
                unitCost: unitCost,
                totalCost: quantity * unitCost,
                receivedQuantity: 0,
              };
            }),
          },
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              contactName: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: employeeId,
          action: "CREATE_PURCHASE_ORDER",
          entity: "PurchaseOrder",
          entityId: purchaseOrder.id,
          details: JSON.stringify({
            poNumber,
            supplierId,
            totalAmount,
            itemCount: items.length,
          }),
        },
      });

      res.status(201).json(purchaseOrder);
    } catch (error) {
      console.error("Error creating purchase order:", error);
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      res.status(500).json({ error: "Failed to create purchase order", details: error.message });
    }
  }
);

// Update purchase order
router.put(
  "/purchase-orders/:id",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("supplierId").optional().isInt().withMessage("Supplier ID must be valid"),
    body("orderDate").optional().isISO8601().withMessage("Order date must be valid"),
    body("expectedDate").optional().isISO8601().withMessage("Expected date must be valid"),
    body("items").optional().isArray().withMessage("Items must be an array"),
    body("items.*.productId").optional().isInt().withMessage("Product ID is required"),
    body("items.*.quantity").optional().isFloat({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("items.*.unitPrice").optional().isFloat({ min: 0 }).withMessage("Unit price must be valid"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { supplierId, orderDate, expectedDate, notes, items } = req.body;
      const employeeId = req.user.id;

      // Check if PO exists
      const existingPO = await prisma.purchaseOrder.findUnique({
        where: { id: parseInt(id) },
        include: { items: true },
      });

      if (!existingPO) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      // Can only edit PENDING orders
      if (existingPO.status !== "PENDING") {
        return res.status(400).json({
          error: `Cannot edit ${existingPO.status.toLowerCase()} purchase order. Only PENDING orders can be edited.`,
        });
      }

      const updateData = {};
      if (supplierId) updateData.supplierId = parseInt(supplierId);
      if (orderDate) updateData.orderDate = new Date(orderDate);
      if (expectedDate) updateData.expectedDate = new Date(expectedDate);
      if (notes !== undefined) updateData.notes = notes;

      // If items are provided, update them
      if (items && items.length > 0) {
        // Calculate new total
        const totalAmount = items.reduce((sum, item) => {
          return sum + item.quantity * item.unitPrice;
        }, 0);
        updateData.totalAmount = totalAmount;

        // Delete old items and create new ones
        await prisma.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: parseInt(id) },
        });

        updateData.items = {
          create: items.map((item) => {
            const unitCost = parseFloat(item.unitPrice);
            const quantity = parseFloat(item.quantity);
            return {
              productId: item.productId,
              quantity: quantity,
              unitCost: unitCost,
              totalCost: quantity * unitCost,
              receivedQuantity: 0,
            };
          }),
        };
      }

      const updatedPO = await prisma.purchaseOrder.update({
        where: { id: parseInt(id) },
        data: updateData,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              contactName: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      });

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: employeeId,
          action: "UPDATE_PURCHASE_ORDER",
          entity: "PurchaseOrder",
          entityId: updatedPO.id,
          details: JSON.stringify({
            ...updateData,
            itemsUpdated: items ? items.length : 0,
          }),
        },
      });

      res.json(updatedPO);
    } catch (error) {
      console.error("Error updating purchase order:", error);
      res.status(500).json({ error: "Failed to update purchase order" });
    }
  }
);

// Receive purchase order items
router.post(
  "/purchase-orders/:id/receive",
  [
    authenticateToken,
    authorizeRoles("ADMIN", "MANAGER"),
    body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
    body("items.*.itemId").isInt().withMessage("Item ID is required"),
    body("items.*.receivedQuantity").isFloat({ min: 0 }).withMessage("Received quantity must be valid"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { items } = req.body;
      const employeeId = req.user.id;

      // Get purchase order with items
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id: parseInt(id) },
        include: {
          items: true,
        },
      });

      if (!purchaseOrder) {
        return res.status(404).json({ error: "Purchase order not found" });
      }

      if (purchaseOrder.status === "CANCELLED") {
        return res.status(400).json({ error: "Cannot receive cancelled purchase order" });
      }

      // Get all product IDs that will be updated
      const productIds = purchaseOrder.items
        .filter((item) => {
          const receivedItem = items.find((ri) => ri.itemId === item.id);
          return receivedItem && receivedItem.receivedQuantity > 0;
        })
        .map((item) => item.productId);

      // Fetch current product data in a single query
      const currentProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          sku: true,
          purchasePrice: true,
          sellingPrice: true,
        },
      });

      // Create a map for quick lookup
      const productMap = new Map(currentProducts.map((p) => [p.id, p]));

      // Process each item - build updates and track changes in a single loop
      const updates = [];
      const stockMovements = [];
      const priceChangeTracker = [];

      for (const receivedItem of items) {
        const poItem = purchaseOrder.items.find((item) => item.id === receivedItem.itemId);

        if (!poItem) {
          return res.status(400).json({ error: `Item ${receivedItem.itemId} not found in purchase order` });
        }

        const newReceivedQuantity = poItem.receivedQuantity + parseFloat(receivedItem.receivedQuantity);

        if (newReceivedQuantity > poItem.quantity) {
          return res.status(400).json({
            error: `Cannot receive more than ordered quantity for item ${receivedItem.itemId}`,
          });
        }

        // Update item received quantity
        updates.push(
          prisma.purchaseOrderItem.update({
            where: { id: receivedItem.itemId },
            data: { receivedQuantity: newReceivedQuantity },
          })
        );

        // Update product stock and purchase price only
        // Note: Selling price is NOT automatically updated - user should manually adjust based on business strategy
        if (receivedItem.receivedQuantity > 0) {
          const newPurchasePrice = poItem.unitCost;
          const currentProduct = productMap.get(poItem.productId);

          // Track price changes for warnings
          if (currentProduct) {
            priceChangeTracker.push({
              productId: poItem.productId,
              productName: currentProduct.name,
              sku: currentProduct.sku,
              oldPurchasePrice: currentProduct.purchasePrice,
              newPurchasePrice: newPurchasePrice,
              sellingPrice: currentProduct.sellingPrice,
            });
          }

          updates.push(
            prisma.product.update({
              where: { id: poItem.productId },
              data: {
                stockQuantity: {
                  increment: parseFloat(receivedItem.receivedQuantity),
                },
                purchasePrice: newPurchasePrice,
              },
            })
          );

          // Create stock movement record
          stockMovements.push({
            productId: poItem.productId,
            movementType: "PURCHASE",
            quantity: parseFloat(receivedItem.receivedQuantity),
            reference: `PO-${purchaseOrder.poNumber}`,
            createdBy: employeeId,
          });
        }
      }

      // Execute all updates in a transaction
      await prisma.$transaction([
        ...updates,
        ...stockMovements.map((movement) => prisma.stockMovement.create({ data: movement })),
      ]);

      // Check for price changes and margin warnings using the tracked data
      const marginWarnings = [];
      for (const trackedItem of priceChangeTracker) {
        const oldPurchasePrice = trackedItem.oldPurchasePrice;
        const newPurchasePrice = trackedItem.newPurchasePrice;
        const sellingPrice = trackedItem.sellingPrice;
        const margin = ((sellingPrice - newPurchasePrice) / sellingPrice) * 100;

        // Check for price changes
        if (Math.abs(oldPurchasePrice - newPurchasePrice) > 0.01) {
          // Check with tolerance for floating point
          const priceChange = newPurchasePrice - oldPurchasePrice;
          const percentChange = oldPurchasePrice > 0 ? ((priceChange / oldPurchasePrice) * 100).toFixed(2) : "0";

          marginWarnings.push({
            productId: trackedItem.productId,
            productName: trackedItem.productName,
            sku: trackedItem.sku,
            oldPurchasePrice: oldPurchasePrice,
            newPurchasePrice: newPurchasePrice,
            priceChange: priceChange,
            percentChange: percentChange,
            sellingPrice: sellingPrice,
            margin: margin.toFixed(2),
            severity: priceChange > 0 ? "price-increase" : "price-decrease",
            message:
              priceChange > 0
                ? `Price increased by ${Math.abs(parseFloat(percentChange)).toFixed(2)}% (৳${oldPurchasePrice.toFixed(
                    2
                  )} → ৳${newPurchasePrice.toFixed(2)})`
                : `Price decreased by ${Math.abs(parseFloat(percentChange)).toFixed(2)}% (৳${oldPurchasePrice.toFixed(
                    2
                  )} → ৳${newPurchasePrice.toFixed(2)})`,
          });
        }

        // Check for margin issues
        if (margin < 0) {
          marginWarnings.push({
            productId: trackedItem.productId,
            productName: trackedItem.productName,
            sku: trackedItem.sku,
            purchasePrice: newPurchasePrice,
            sellingPrice: sellingPrice,
            margin: margin.toFixed(2),
            severity: "critical",
            message: `Negative margin: Selling price (৳${sellingPrice.toFixed(
              2
            )}) is lower than purchase price (৳${newPurchasePrice.toFixed(2)})`,
          });
        } else if (margin < 10) {
          marginWarnings.push({
            productId: trackedItem.productId,
            productName: trackedItem.productName,
            sku: trackedItem.sku,
            purchasePrice: newPurchasePrice,
            sellingPrice: sellingPrice,
            margin: margin.toFixed(2),
            severity: "warning",
            message: `Low margin: Only ${margin.toFixed(2)}% profit margin`,
          });
        }
      }

      // Get updated PO to check status
      const updatedPO = await prisma.purchaseOrder.findUnique({
        where: { id: parseInt(id) },
        include: {
          items: true,
          supplier: {
            select: {
              id: true,
              name: true,
              contactName: true,
            },
          },
        },
      });

      // Determine new status
      const allReceived = updatedPO.items.every((item) => item.receivedQuantity >= item.quantity);
      const anyReceived = updatedPO.items.some((item) => item.receivedQuantity > 0);

      let newStatus = updatedPO.status;
      let receivedDate = updatedPO.receivedDate;

      if (allReceived) {
        newStatus = "RECEIVED";
        receivedDate = new Date();
      } else if (anyReceived) {
        newStatus = "PARTIAL";
      }

      // Update PO status if changed
      if (newStatus !== updatedPO.status) {
        await prisma.purchaseOrder.update({
          where: { id: parseInt(id) },
          data: {
            status: newStatus,
            receivedDate,
          },
        });
      }

      // Create audit log
      await prisma.auditLog.create({
        data: {
          userId: employeeId,
          action: "RECEIVE_PURCHASE_ORDER",
          entity: "PurchaseOrder",
          entityId: updatedPO.id,
          details: JSON.stringify({
            itemsReceived: items.length,
            newStatus,
          }),
        },
      });

      // Get final updated PO
      const finalPO = await prisma.purchaseOrder.findUnique({
        where: { id: parseInt(id) },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
              contactName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      res.json({
        message: "Items received successfully",
        purchaseOrder: finalPO,
        warnings: marginWarnings.length > 0 ? marginWarnings : undefined,
      });
    } catch (error) {
      console.error("Error receiving purchase order:", error);
      res.status(500).json({ error: "Failed to receive purchase order" });
    }
  }
);

// Cancel purchase order
router.delete("/purchase-orders/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], async (req, res) => {
  try {
    const { id } = req.params;
    const employeeId = req.user.id;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: true,
      },
    });

    if (!purchaseOrder) {
      return res.status(404).json({ error: "Purchase order not found" });
    }

    if (purchaseOrder.status === "RECEIVED") {
      return res.status(400).json({
        error: "Cannot cancel a fully received purchase order",
      });
    }

    const updatedPO = await prisma.purchaseOrder.update({
      where: { id: parseInt(id) },
      data: {
        status: "CANCELLED",
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        items: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: employeeId,
        action: "CANCEL_PURCHASE_ORDER",
        entity: "PurchaseOrder",
        entityId: updatedPO.id,
        details: JSON.stringify({
          totalAmount: updatedPO.totalAmount,
          itemCount: updatedPO.items.length,
        }),
      },
    });

    res.json({
      message: "Purchase order cancelled successfully",
      purchaseOrder: updatedPO,
    });
  } catch (error) {
    console.error("Error cancelling purchase order:", error);
    res.status(500).json({ error: "Failed to cancel purchase order" });
  }
});

// Get purchase order statistics
router.get(
  "/purchase-orders/stats/summary",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER")],
  async (req, res) => {
    try {
      const { startDate, endDate, supplierId } = req.query;

      const where = {};

      if (supplierId) {
        where.supplierId = parseInt(supplierId);
      }

      if (startDate || endDate) {
        where.orderDate = {};
        if (startDate) {
          where.orderDate.gte = new Date(startDate);
        }
        if (endDate) {
          where.orderDate.lte = new Date(endDate);
        }
      }

      const [totalOrders, pendingOrders, receivedOrders, cancelledOrders, totalValue] = await Promise.all([
        prisma.purchaseOrder.count({ where }),
        prisma.purchaseOrder.count({ where: { ...where, status: "PENDING" } }),
        prisma.purchaseOrder.count({ where: { ...where, status: "RECEIVED" } }),
        prisma.purchaseOrder.count({ where: { ...where, status: "CANCELLED" } }),
        prisma.purchaseOrder.aggregate({
          where: { ...where, status: { not: "CANCELLED" } },
          _sum: { totalAmount: true },
        }),
      ]);

      res.json({
        totalOrders,
        pendingOrders,
        receivedOrders,
        cancelledOrders,
        partiallyReceivedOrders: totalOrders - pendingOrders - receivedOrders - cancelledOrders,
        totalValue: totalValue._sum.totalAmount || 0,
      });
    } catch (error) {
      console.error("Error fetching PO statistics:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  }
);

module.exports = router;
