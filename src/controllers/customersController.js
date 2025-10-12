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
} from "../services/customersService.js";

// Get all customers with pagination and search
async function getCustomers(req, res) {
  try {
    const errors = req.validationResult ? req.validationResult() : [];
    if (errors && errors.length > 0) {
      return res.status(400).json({ errors });
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
    const [customers, total] = await Promise.all([fetchCustomers(where, skip, limit), countCustomers(countWhere)]);
    res.json({
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
    res.status(500).json({ error: "Failed to fetch customers", data: error });
  }
}

// Get customer by phone number (for POS lookup)
async function getCustomerByPhone(req, res) {
  try {
    const { phone } = req.params;
    const customer = await findCustomerByPhone(phone);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(customer);
  } catch (error) {
    console.error("Get customer by phone error:", error);
    res.status(500).json({ error: "Failed to get customer" });
  }
}

// Search customers by phone number or name (for POS lookup)
async function searchCustomersController(req, res) {
  try {
    const { query } = req.params;
    const customers = await searchCustomers(query);
    res.json(customers);
  } catch (error) {
    console.error("Search customers error:", error);
    res.status(500).json({ error: "Failed to search customers" });
  }
}

// Get customer by ID
async function getCustomerById(req, res) {
  try {
    const { id } = req.params;
    const customerId = parseInt(id);
    const customer = await findCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const totalSpent = await aggregateTotalSpent(customerId);
    res.json({
      ...customer,
      totalSpent: totalSpent._sum.finalAmount || 0,
    });
  } catch (error) {
    console.error("Get customer error:", error);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
}

// Create new customer
async function createCustomer(req, res) {
  try {
    const errors = req.validationResult ? req.validationResult() : [];
    if (errors && errors.length > 0) {
      return res.status(400).json({ errors });
    }
    const { name, phoneNumber, email, dateOfBirth, address } = req.body;
    if (phoneNumber || email) {
      const existing = await findExistingCustomer(phoneNumber, email);
      if (existing) {
        return res.status(400).json({ error: "Customer with this phone number or email already exists" });
      }
    }
    const customer = await createCustomerService({
      name: name.trim(),
      phoneNumber,
      email,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      address,
    });
    res.status(201).json(customer);
  } catch (error) {
    console.error("Create customer error:", error);
    res.status(500).json({ error: "Failed to create customer" });
  }
}

// Update customer
async function updateCustomer(req, res) {
  try {
    const errors = req.validationResult ? req.validationResult() : [];
    if (errors && errors.length > 0) {
      return res.status(400).json({ errors });
    }
    const { id } = req.params;
    const customerId = parseInt(id);
    const existingCustomer = await findCustomerById(customerId);
    if (!existingCustomer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    if (req.body.phoneNumber || req.body.email) {
      const conflicts = await findCustomerConflict(customerId, req.body.phoneNumber, req.body.email);
      if (conflicts) {
        return res.status(400).json({ error: "Another customer with this phone number or email already exists" });
      }
    }
    const updateData = { ...req.body };
    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }
    if (updateData.dateOfBirth) {
      updateData.dateOfBirth = new Date(updateData.dateOfBirth);
    }
    const customer = await updateCustomerService(customerId, updateData);
    res.json(customer);
  } catch (error) {
    console.error("Update customer error:", error);
    res.status(500).json({ error: "Failed to update customer" });
  }
}

// Deactivate customer (soft delete)
async function deactivateCustomer(req, res) {
  try {
    const { id } = req.params;
    const customerId = parseInt(id);
    const customer = await findCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    await deactivateCustomerService(customerId);
    res.json({ message: "Customer deactivated successfully" });
  } catch (error) {
    console.error("Delete customer error:", error);
    res.status(500).json({ error: "Failed to deactivate customer" });
  }
}

// Add loyalty points
async function addLoyaltyPoints(req, res) {
  try {
    const errors = req.validationResult ? req.validationResult() : [];
    if (errors && errors.length > 0) {
      return res.status(400).json({ errors });
    }
    const { id } = req.params;
    const { points } = req.body;
    const customerId = parseInt(id);
    const customer = await findCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const updatedCustomer = await addLoyaltyPointsService(customerId, points);
    res.json({
      message: `Added ${points} loyalty points`,
      customer: {
        id: updatedCustomer.id,
        name: updatedCustomer.name,
        loyaltyPoints: updatedCustomer.loyaltyPoints,
      },
    });
  } catch (error) {
    console.error("Add loyalty points error:", error);
    res.status(500).json({ error: "Failed to add loyalty points" });
  }
}

// Redeem loyalty points
async function redeemLoyaltyPoints(req, res) {
  try {
    const errors = req.validationResult ? req.validationResult() : [];
    if (errors && errors.length > 0) {
      return res.status(400).json({ errors });
    }
    const { id } = req.params;
    const { points } = req.body;
    const customerId = parseInt(id);
    const customer = await findCustomerById(customerId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    if (customer.loyaltyPoints < points) {
      return res.status(400).json({
        error: "Insufficient loyalty points",
        availablePoints: customer.loyaltyPoints,
        requestedPoints: points,
      });
    }
    const updatedCustomer = await redeemLoyaltyPointsService(customerId, points);
    const discountAmount = points * 0.01;
    res.json({
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
    res.status(500).json({ error: "Failed to redeem loyalty points" });
  }
}

export {
  getCustomers,
  getCustomerByPhone,
  searchCustomersController,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  addLoyaltyPoints,
  redeemLoyaltyPoints,
};
