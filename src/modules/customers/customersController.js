import { validationResult } from "express-validator";
import { sendError } from "../../utils/response.js";
import { sendSuccess } from "../../utils/response.js";
import {
  addLoyaltyPointsService,
  aggregateTotalSpent,
  countCustomers,
  createCustomerService,
  deactivateCustomerService,
  fetchCustomers,
  findCustomerById,
  findCustomerByPhone,
  findCustomerConflict,
  findExistingCustomer,
  redeemLoyaltyPointsService,
  searchCustomers,
  updateCustomerService,
} from "./customersService.js";

// Get all customers with pagination and search
async function getCustomers(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search;
    const skip = (page - 1) * limit;
    const where = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phoneNumber: { contains: search } },
        { email: { contains: search } },
      ];
    }
    let countWhere = { ...where };
    if (search) {
      countWhere = {
        ...countWhere,
        OR: [{ name: { contains: search } }, { phoneNumber: { contains: search } }, { email: { contains: search } }],
      };
    }
    const storeId = req.user.storeId;
    const [customers, total] = await Promise.all([
      fetchCustomers(where, skip, limit, storeId),
      countCustomers(countWhere, storeId),
    ]);
    sendSuccess(res, {
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalItems: total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get customers error:", error);
    sendError(res, 500, "Failed to fetch customers", error);
  }
}

// Get customer by phone number (for POS lookup)
async function getCustomerByPhone(req, res) {
  try {
    const { phone } = req.params;
    const storeId = req.user.storeId;
    const customer = await findCustomerByPhone(phone, storeId);
    if (!customer) {
      return sendError(res, 404, "Customer not found");
    }
    sendSuccess(res, customer);
  } catch (error) {
    console.error("Get customer by phone error:", error);
    sendError(res, 500, "Failed to get customer");
  }
}

// Search customers by phone number or name (for POS lookup)
async function searchCustomersController(req, res) {
  try {
    const { query } = req.params;
    const storeId = req.user.storeId;
    const customers = await searchCustomers(query, storeId);
    sendSuccess(res, customers);
  } catch (error) {
    console.error("Search customers error:", error);
    sendError(res, 500, "Failed to search customers");
  }
}

// Get customer by ID
async function getCustomerById(req, res) {
  try {
    const { id } = req.params;
    const customerId = parseInt(id);
    const storeId = req.user.storeId;
    const customer = await findCustomerById(customerId, storeId);
    if (!customer) {
      return sendError(res, 404, "Customer not found");
    }
    const totalSpent = await aggregateTotalSpent(customerId, storeId);
    sendSuccess(res, {
      ...customer,
      totalSpent: totalSpent._sum.finalAmount || 0,
    });
  } catch (error) {
    console.error("Get customer error:", error);
    sendError(res, 500, "Failed to fetch customer");
  }
}

// Create new customer
async function createCustomer(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const { name, phoneNumber, email, dateOfBirth, address, storeIds } = req.body;
    // storeIds should be an array of store IDs to assign this customer to
    if (!storeIds || !Array.isArray(storeIds) || storeIds.length === 0) {
      return sendError(res, 400, "storeIds array is required");
    }
    // Check for existing customer in any of the stores
    for (const storeId of storeIds) {
      if (phoneNumber || email) {
        const existing = await findExistingCustomer(phoneNumber, email, storeId);
        if (existing) {
          return sendError(res, 400, `Customer with this phone number or email already exists in store ${storeId}`);
        }
      }
    }
    const customer = await createCustomerService({
      name: name.trim(),
      phoneNumber,
      email,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      address,
      storeIds,
    });
    sendSuccess(res, customer, 201);
  } catch (error) {
    console.error("Create customer error:", error);
    sendError(res, 500, "Failed to create customer");
  }
}

// Update customer
async function updateCustomer(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const { id } = req.params;
    const customerId = parseInt(id);
    const storeId = req.user.storeId;
    const existingCustomer = await findCustomerById(customerId, storeId);
    if (!existingCustomer) {
      return sendError(res, 404, "Customer not found");
    }
    if (req.body.phoneNumber || req.body.email) {
      const conflicts = await findCustomerConflict(customerId, req.body.phoneNumber, req.body.email, storeId);
      if (conflicts) {
        return sendError(res, 400, "Another customer with this phone number or email already exists");
      }
    }
    const updateData = { ...req.body };
    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }
    if (updateData.dateOfBirth) {
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }
    const customer = await updateCustomerService(customerId, updateData, storeId);
    sendSuccess(res, customer);
  } catch (error) {
    console.error("Update customer error:", error);
    sendError(res, 500, "Failed to update customer");
  }
}

// Deactivate customer (soft delete)
async function deactivateCustomer(req, res) {
  try {
    const { id } = req.params;
    const customerId = parseInt(id);
    const storeId = req.user.storeId;
    const customer = await findCustomerById(customerId, storeId);
    if (!customer) {
      return sendError(res, 404, "Customer not found");
    }
    await deactivateCustomerService(customerId, storeId);
    sendSuccess(res, { message: "Customer deactivated successfully" });
  } catch (error) {
    console.error("Delete customer error:", error);
    sendError(res, 500, "Failed to deactivate customer");
  }
}

// Add loyalty points
async function addLoyaltyPoints(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const { id } = req.params;
    const { points } = req.body;
    const customerId = parseInt(id);
    const storeId = req.user.storeId;
    const customer = await findCustomerById(customerId, storeId);
    if (!customer) {
      return sendError(res, 404, "Customer not found");
    }
    const updatedCustomer = await addLoyaltyPointsService(customerId, points, storeId);
    sendSuccess(res, {
      message: `Added ${points} loyalty points`,
      customer: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        loyaltyPoints: updatedCustomer.loyaltyPoints,
      },
    });
  } catch (error) {
    console.error("Add loyalty points error:", error);
    sendError(res, 500, "Failed to add loyalty points");
  }
}

// Redeem loyalty points
async function redeemLoyaltyPoints(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, errors.array());
    }
    const { id } = req.params;
    const { points } = req.body;
    const customerId = parseInt(id);
    const storeId = req.user.storeId;
    const customer = await findCustomerById(customerId, storeId);
    if (!customer) {
      return sendError(res, 404, "Customer not found");
    }
    if (customer.loyaltyPoints < points) {
      return sendError(res, 400, "Insufficient loyalty points", {
        availablePoints: customer.loyaltyPoints,
        requestedPoints: points,
      });
    }
    const updatedCustomer = await redeemLoyaltyPointsService(customerId, points, storeId);
    const discountAmount = points * 0.01;
    sendSuccess(res, {
      message: `Redeemed ${points} loyalty points`,
      discountAmount,
      customer: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        loyaltyPoints: updatedCustomer.loyaltyPoints,
      },
    });
  } catch (error) {
    console.error("Redeem loyalty points error:", error);
    sendError(res, 500, "Failed to redeem loyalty points");
  }
}

export {
  addLoyaltyPoints,
  createCustomer,
  deactivateCustomer,
  getCustomerById,
  getCustomerByPhone,
  getCustomers,
  redeemLoyaltyPoints,
  searchCustomersController,
  updateCustomer,
};
