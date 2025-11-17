import { PrismaClient } from "@prisma/client";
import { checkAndCreateAlerts } from "../notifications/notificationService.js";
import { logAudit } from "../../utils/auditLogger.js";
const prisma = new PrismaClient();

export async function getStockMovementsService({ page, limit, productId, movementType, startDate, endDate, storeId }) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const skip = (page - 1) * limit;
  const where = { storeId };
  if (productId) where.productId = productId;
  if (movementType) where.movementType = movementType;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }
  return prisma.stockMovement.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  });
}

export async function createStockAdjustmentService(data, userId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const { productId, quantity, movementType, reason } = data;
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({ where: { id: productId, storeId } });
    if (!product) throw new Error("Product not found in this store");
    const updatedProduct = await tx.product.update({
      where: { id: productId, storeId },
      data: { stockQuantity: { increment: quantity } },
    });
    const movement = await tx.stockMovement.create({
      data: {
        productId,
        movementType,
        quantity,
        reason: reason || "Manual stock adjustment",
        createdBy: userId,
        storeId,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    });
    return { movement, updatedStock: updatedProduct.stockQuantity };
  });

  try {
    await checkAndCreateAlerts(productId, storeId);
  } catch (err) {
    console.error("Failed to check/create alerts after stock adjustment:", err);
  }

  return result;
}

export async function getInventorySummaryService(storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const [totalProducts, totalValue, lowStockCount] = await Promise.all([
    prisma.product.count({ where: { isActive: true, storeId } }),
    prisma.product.aggregate({ where: { isActive: true, storeId }, _sum: { stockQuantity: true } }),
    prisma.product.count({ where: { isActive: true, storeId, stockQuantity: { lte: 10 } } }),
  ]);
  const products = await prisma.product.findMany({
    where: { isActive: true, storeId },
    select: { stockQuantity: true, purchasePrice: true },
  });
  const totalInventoryValue = products.reduce((sum, product) => sum + product.stockQuantity * product.purchasePrice, 0);
  return {
    totalProducts,
    totalItems: totalValue._sum.stockQuantity || 0,
    totalInventoryValue,
    lowStockProducts: lowStockCount || 0,
  };
}

export async function bulkStockUpdateService(updates, reason, userId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  // Perform DB updates inside a transaction, but defer alert checks until after the transaction
  const res = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const update of updates) {
      const product = await tx.product.findFirst({ where: { id: update.productId, storeId } });
      if (!product) throw new Error(`Product with ID ${update.productId} not found in this store`);
      const quantityDifference = update.newQuantity - product.stockQuantity;
      await tx.product.update({
        where: { id: update.productId, storeId },
        data: { stockQuantity: update.newQuantity },
      });
      if (quantityDifference !== 0) {
        await tx.stockMovement.create({
          data: {
            productId: update.productId,
            movementType: "ADJUSTMENT",
            quantity: quantityDifference,
            reason: reason || "Bulk stock update",
            createdBy: userId,
            storeId,
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
    return { message: `Updated stock for ${results.length} products`, updates: results };
  });

  // Run alerts after transaction completes
  try {
    await Promise.all(res.updates.map((u) => checkAndCreateAlerts(u.productId, storeId)));
  } catch (err) {
    console.error("Failed to check/create alerts after bulk stock update:", err);
  }

  return res;
}

export async function stockTransferService(data, userId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const { productId, productVariantId, quantity, fromLocation, toLocation, notes } = data;
  const transferId = `TR-${Date.now()}`;
  return prisma.$transaction(async (tx) => {
    // Ensure product belongs to store
    const product = await tx.product.findFirst({ where: { id: productId, storeId } });
    if (!product) throw new Error("Product not found in this store");
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
        createdBy: userId,
        storeId,
      },
    });
    const inMovement = await tx.stockMovement.create({
      data: {
        productId,
        productVariantId,
        movementType: "TRANSFER",
        quantity,
        reason: `Transfer from ${fromLocation}`,
        reference: transferId,
        fromLocation,
        toLocation,
        createdBy: userId,
        storeId,
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        productVariant: { select: { id: true, name: true } },
      },
    });
    return { transferId, outMovement, inMovement };
  });
}

export async function getStockAlertsService(query, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const where = { storeId };
  if (query.isResolved !== undefined) {
    where.isResolved = query.isResolved === "true";
  }
  return prisma.stockAlert.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, sku: true, stockQuantity: true, lowStockThreshold: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveStockAlertService(id, userId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.stockAlert.update({
    where: { id, storeId },
    data: { isResolved: true, resolvedAt: new Date(), resolvedBy: userId },
    include: { product: { select: { id: true, name: true } } },
  });
}

export async function receivePurchaseOrderService(data, userId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const { purchaseOrderId, items } = data;
  const productIdsToCheck = new Set();
  const result = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({ where: { id: purchaseOrderId, storeId }, include: { items: true } });
    if (!po) throw new Error("Purchase order not found in this store");
    for (const receivedItem of items) {
      const poItem = po.items.find((i) => i.productId === receivedItem.productId);
      if (!poItem) continue;
      await tx.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: { receivedQuantity: { increment: receivedItem.receivedQuantity } },
      });
      await tx.product.update({
        where: { id: receivedItem.productId, storeId },
        data: { stockQuantity: { increment: receivedItem.receivedQuantity } },
      });
      productIdsToCheck.add(receivedItem.productId);
      await tx.stockMovement.create({
        data: {
          productId: receivedItem.productId,
          movementType: "PURCHASE",
          quantity: receivedItem.receivedQuantity,
          reason: "Purchase order received",
          reference: po.poNumber,
          createdBy: userId,
          storeId,
        },
      });
    }
    const updatedPO = await tx.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, storeId },
      include: { items: true },
    });
    const allReceived = updatedPO.items.every((item) => item.receivedQuantity >= item.quantity);
    const partiallyReceived = updatedPO.items.some((item) => item.receivedQuantity > 0);
    const newStatus = allReceived ? "RECEIVED" : partiallyReceived ? "PARTIALLY_RECEIVED" : "ORDERED";
    return tx.purchaseOrder.update({
      where: { id: purchaseOrderId, storeId },
      data: { status: newStatus, receivedDate: allReceived ? new Date() : null },
      include: { supplier: true, items: { include: { product: true } } },
    });
  });
  try {
    await Promise.all(Array.from(productIdsToCheck).map((pid) => checkAndCreateAlerts(pid, storeId)));
  } catch (err) {
    console.error("Failed to check/create alerts after receiving purchase order:", err);
  }
  return result;
}

export async function getPurchaseOrdersService(query, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const { page = 1, limit = 20, status, supplierId, startDate, endDate } = query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);
  const where = { storeId };
  if (status) where.status = status;
  if (supplierId) where.supplierId = parseInt(supplierId);
  if (startDate || endDate) {
    where.orderDate = {};
    if (startDate) where.orderDate.gte = new Date(startDate);
    if (endDate) where.orderDate.lte = new Date(endDate);
  }
  const [purchaseOrders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take,
      include: {
        supplier: { select: { id: true, name: true, contactName: true, email: true, phone: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);
  return { purchaseOrders, pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) } };
}

export async function getPurchaseOrderByIdService(id, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  return prisma.purchaseOrder.findFirst({
    where: { id, storeId },
    include: {
      supplier: { select: { id: true, name: true, contactName: true, email: true, phone: true, address: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true, barcode: true } } } },
    },
  });
}

export async function createPurchaseOrderService(data, userId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const { supplierId, orderDate, expectedDate, items, notes } = data;
  const poCount = await prisma.purchaseOrder.count({ where: { storeId } });
  const poNumber = `PO-${new Date().getFullYear()}-${String(poCount + 1).padStart(5, "0")}`;
  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: parseInt(supplierId),
      orderDate: new Date(orderDate),
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      status: "PENDING",
      totalAmount,
      notes: notes || null,
      storeId,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: parseFloat(item.quantity),
          unitCost: parseFloat(item.unitPrice),
          totalCost: parseFloat(item.quantity) * parseFloat(item.unitPrice),
          receivedQuantity: 0,
        })),
      },
    },
    include: {
      supplier: { select: { id: true, name: true, contactName: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  });
  await logAudit({
    userId,
    action: "CREATE_PURCHASE_ORDER",
    entity: "PurchaseOrder",
    entityId: purchaseOrder.id,
    details: { poNumber, supplierId, totalAmount, itemCount: items.length },
  });
  return purchaseOrder;
}

export async function updatePurchaseOrderService(id, data, userId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const { supplierId, orderDate, expectedDate, notes, items } = data;
  const existingPO = await prisma.purchaseOrder.findFirst({ where: { id, storeId }, include: { items: true } });
  if (!existingPO) throw new Error("Purchase order not found in this store");
  if (existingPO.status !== "PENDING")
    throw new Error(
      `Cannot edit ${existingPO.status.toLowerCase()} purchase order. Only PENDING orders can be edited.`
    );
  const updateData = {};
  if (supplierId) updateData.supplierId = parseInt(supplierId);
  if (orderDate) updateData.orderDate = new Date(orderDate);
  if (expectedDate) updateData.expectedDate = new Date(expectedDate);
  if (notes !== undefined) updateData.notes = notes;
  if (items && items.length > 0) {
    const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    updateData.totalAmount = totalAmount;
    await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    updateData.items = {
      create: items.map((item) => ({
        productId: item.productId,
        quantity: parseFloat(item.quantity),
        unitCost: parseFloat(item.unitPrice),
        totalCost: parseFloat(item.quantity) * parseFloat(item.unitPrice),
        receivedQuantity: 0,
      })),
    };
  }
  const updatedPO = await prisma.purchaseOrder.update({
    where: { id, storeId },
    data: updateData,
    include: {
      supplier: { select: { id: true, name: true, contactName: true } },
      items: { include: { product: { id: true, name: true, sku: true } } },
    },
  });
  await logAudit({
    userId,
    action: "UPDATE_PURCHASE_ORDER",
    entity: "PurchaseOrder",
    entityId: updatedPO.id,
    details: { ...updateData, itemsUpdated: items ? items.length : 0 },
  });
  return updatedPO;
}

export async function receivePurchaseOrderItemsService(id, items, userId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const purchaseOrder = await prisma.purchaseOrder.findFirst({ where: { id, storeId }, include: { items: true } });
  if (!purchaseOrder) throw new Error("Purchase order not found in this store");
  if (purchaseOrder.status === "CANCELLED") throw new Error("Cannot receive cancelled purchase order");
  const productIds = purchaseOrder.items
    .filter((item) => {
      const receivedItem = items.find((ri) => ri.itemId === item.id);
      return receivedItem && receivedItem.receivedQuantity > 0;
    })
    .map((item) => item.productId);
  const currentProducts = await prisma.product.findMany({
    where: { id: { in: productIds }, storeId },
    select: { id: true, name: true, sku: true, purchasePrice: true, sellingPrice: true },
  });
  const productMap = new Map(currentProducts.map((p) => [p.id, p]));
  const updates = [];
  const stockMovements = [];
  const priceChangeTracker = [];
  for (const receivedItem of items) {
    const poItem = purchaseOrder.items.find((item) => item.id === receivedItem.itemId);
    if (!poItem) throw new Error(`Item ${receivedItem.itemId} not found in purchase order`);
    const newReceivedQuantity = poItem.receivedQuantity + parseFloat(receivedItem.receivedQuantity);
    if (newReceivedQuantity > poItem.quantity)
      throw new Error(`Cannot receive more than ordered quantity for item ${receivedItem.itemId}`);
    updates.push(
      prisma.purchaseOrderItem.update({
        where: { id: receivedItem.itemId },
        data: { receivedQuantity: newReceivedQuantity },
      })
    );
    if (receivedItem.receivedQuantity > 0) {
      const newPurchasePrice = poItem.unitCost;
      const currentProduct = productMap.get(poItem.productId);
      if (currentProduct) {
        priceChangeTracker.push({
          productId: poItem.productId,
          productName: currentProduct.name,
          sku: currentProduct.sku,
          oldPurchasePrice: currentProduct.purchasePrice,
          newPurchasePrice,
          sellingPrice: currentProduct.sellingPrice,
        });
      }
      updates.push(
        prisma.product.update({
          where: { id: poItem.productId, storeId },
          data: {
            stockQuantity: { increment: parseFloat(receivedItem.receivedQuantity) },
            purchasePrice: newPurchasePrice,
          },
        })
      );
      stockMovements.push({
        productId: poItem.productId,
        movementType: "PURCHASE",
        quantity: parseFloat(receivedItem.receivedQuantity),
        reference: `PO-${purchaseOrder.poNumber}`,
        createdBy: userId,
        storeId,
      });
    }
  }
  await prisma.$transaction([
    ...updates,
    ...stockMovements.map((movement) => prisma.stockMovement.create({ data: movement })),
  ]);
  const marginWarnings = [];
  for (const trackedItem of priceChangeTracker) {
    const oldPurchasePrice = trackedItem.oldPurchasePrice;
    const newPurchasePrice = trackedItem.newPurchasePrice;
    const sellingPrice = trackedItem.sellingPrice;
    const margin = ((sellingPrice - newPurchasePrice) / sellingPrice) * 100;
    if (Math.abs(oldPurchasePrice - newPurchasePrice) > 0.01) {
      const priceChange = newPurchasePrice - oldPurchasePrice;
      const percentChange = oldPurchasePrice > 0 ? ((priceChange / oldPurchasePrice) * 100).toFixed(2) : "0";
      marginWarnings.push({
        productId: trackedItem.productId,
        productName: trackedItem.productName,
        sku: trackedItem.sku,
        oldPurchasePrice,
        newPurchasePrice,
        priceChange,
        percentChange,
        sellingPrice,
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
    if (margin < 0) {
      marginWarnings.push({
        productId: trackedItem.productId,
        productName: trackedItem.productName,
        sku: trackedItem.sku,
        purchasePrice: newPurchasePrice,
        sellingPrice,
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
        sellingPrice,
        margin: margin.toFixed(2),
        severity: "warning",
        message: `Low margin: Only ${margin.toFixed(2)}% profit margin`,
      });
    }
  }
  const updatedPO = await prisma.purchaseOrder.findFirst({
    where: { id, storeId },
    include: { items: true, supplier: { select: { id: true, name: true, contactName: true } } },
  });
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
  if (newStatus !== updatedPO.status) {
    await prisma.purchaseOrder.update({ where: { id, storeId }, data: { status: newStatus, receivedDate } });
  }
  await logAudit({
    userId,
    action: "RECEIVE_PURCHASE_ORDER",
    entity: "PurchaseOrder",
    entityId: updatedPO.id,
    details: { itemsReceived: items.length, newStatus },
  });
  const finalPO = await prisma.purchaseOrder.findFirst({
    where: { id, storeId },
    include: {
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      supplier: { select: { id: true, name: true, contactName: true, email: true, phone: true } },
    },
  });
  return {
    message: "Items received successfully",
    purchaseOrder: finalPO,
    warnings: marginWarnings.length > 0 ? marginWarnings : undefined,
  };
}

export async function cancelPurchaseOrderService(id, userId, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const purchaseOrder = await prisma.purchaseOrder.findFirst({ where: { id, storeId }, include: { items: true } });
  if (!purchaseOrder) throw new Error("Purchase order not found in this store");
  if (purchaseOrder.status === "RECEIVED") throw new Error("Cannot cancel a fully received purchase order");
  const updatedPO = await prisma.purchaseOrder.update({
    where: { id, storeId },
    data: { status: "CANCELLED" },
    include: { supplier: { select: { id: true, name: true } }, items: true },
  });
  await logAudit({
    userId,
    action: "CANCEL_PURCHASE_ORDER",
    entity: "PurchaseOrder",
    entityId: updatedPO.id,
    details: { totalAmount: updatedPO.totalAmount, itemCount: updatedPO.items.length },
  });
  return { message: "Purchase order cancelled successfully", purchaseOrder: updatedPO };
}

export async function getPurchaseOrderStatsService(query, storeId) {
  if (!storeId) throw new Error("storeId is required for multi-tenant isolation");
  const { startDate, endDate, supplierId } = query;
  const where = { storeId };
  if (supplierId) where.supplierId = parseInt(supplierId);
  if (startDate || endDate) {
    where.orderDate = {};
    if (startDate) where.orderDate.gte = new Date(startDate);
    if (endDate) where.orderDate.lte = new Date(endDate);
  }
  const [totalOrders, pendingOrders, receivedOrders, cancelledOrders, totalValue] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.count({ where: { ...where, status: "PENDING" } }),
    prisma.purchaseOrder.count({ where: { ...where, status: "RECEIVED" } }),
    prisma.purchaseOrder.count({ where: { ...where, status: "CANCELLED" } }),
    prisma.purchaseOrder.aggregate({ where: { ...where, status: { not: "CANCELLED" } }, _sum: { totalAmount: true } }),
  ]);
  return {
    totalOrders,
    pendingOrders,
    receivedOrders,
    cancelledOrders,
    partiallyReceivedOrders: totalOrders - pendingOrders - receivedOrders - cancelledOrders,
    totalValue: totalValue._sum.totalAmount || 0,
  };
}
