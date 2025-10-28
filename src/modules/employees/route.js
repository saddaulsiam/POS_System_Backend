import express from "express";
import multer from "multer";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as employeesController from "./employeesController.js";
import {
  createEmployeeValidator,
  getAllEmployeesValidator,
  getEmployeePerformanceValidator,
  resetPinValidator,
  updateEmployeeValidator,
} from "./employeesValidator.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router
  .route("/")
  .post(
    [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...createEmployeeValidator],
    employeesController.createEmployee
  )
  .get(
    [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...getAllEmployeesValidator],
    employeesController.getAllEmployees
  );

router
  .route("/:id")
  .get([authenticateToken, authorizeRoles("ADMIN", "MANAGER")], employeesController.getEmployeeById)
  .put(
    [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...updateEmployeeValidator],
    employeesController.updateEmployee
  )
  .delete([authenticateToken, authorizeRoles("ADMIN", "MANAGER")], employeesController.deactivateEmployee);

// Reset employee PIN
router.put(
  "/:id/reset-pin",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...resetPinValidator],
  employeesController.resetEmployeePin
);

// Get employee performance report
router.get(
  "/:id/performance",
  [authenticateToken, authorizeRoles("ADMIN", "MANAGER"), ...getEmployeePerformanceValidator],
  employeesController.getEmployeePerformance
);

// Upload employee photo
router.post(
  "/:id/photo",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  upload.single("photo"),
  employeesController.uploadEmployeePhoto
);

// --- Salary Sheet Management ---
router.get(
  "/salary-sheets",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  employeesController.getAllSalarySheets
);
router.get(
  "/salary-sheets/:employeeId",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  employeesController.getEmployeeSalarySheets
);
router.post(
  "/salary-sheets",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  employeesController.createSalarySheet
);
router.put(
  "/salary-sheets/:id",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  employeesController.updateSalarySheet
);
router.post(
  "/salary-sheets/:id/pay",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  employeesController.markSalaryAsPaid
);
router.delete(
  "/salary-sheets/:id",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  employeesController.deleteSalarySheet
);

export const EmployeeRoutes = router;
