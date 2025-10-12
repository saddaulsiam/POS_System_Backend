import express from "express";
import employeesController from "./employeesController.js";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import {
  createEmployeeValidator,
  getAllEmployeesValidator,
  getEmployeePerformanceValidator,
  resetPinValidator,
  updateEmployeeValidator,
} from "./employeesValidator.js";

const router = express.Router();

// Get all employees
router.get(
  "/",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...getAllEmployeesValidator],
  employeesController.getAllEmployees
);

// Get employee by ID
router.get("/:id", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], employeesController.getEmployeeById);

// Create new employee
router.post(
  "/",
  [authenticateToken, authorizeRoles("ADMIN"), ...createEmployeeValidator],
  employeesController.createEmployee
);

// Update employee
router.put(
  "/:id",
  [authenticateToken, authorizeRoles("ADMIN"), ...updateEmployeeValidator],
  employeesController.updateEmployee
);

// Reset employee PIN
router.put(
  "/:id/reset-pin",
  [authenticateToken, authorizeRoles("ADMIN"), ...resetPinValidator],
  employeesController.resetEmployeePin
);

// Get employee performance report
router.get(
  "/:id/performance",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...getEmployeePerformanceValidator],
  employeesController.getEmployeePerformance
);

// Deactivate employee (soft delete)
router.delete("/:id", [authenticateToken, authorizeRoles("ADMIN")], employeesController.deactivateEmployee);

export default router;
