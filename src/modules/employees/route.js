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
    [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...createEmployeeValidator],
    employeesController.createEmployee
  )
  .get(
    [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...getAllEmployeesValidator],
    employeesController.getAllEmployees
  );

router
  .route("/:id")
  .get([authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER")], employeesController.getEmployeeById)
  .put(
    [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...updateEmployeeValidator],
    employeesController.updateEmployee
  )
  .delete([authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER")], employeesController.deactivateEmployee);

// Reset employee PIN
router.put(
  "/:id/reset-pin",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...resetPinValidator],
  employeesController.resetEmployeePin
);

// Get employee performance report
router.get(
  "/:id/performance",
  [authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), ...getEmployeePerformanceValidator],
  employeesController.getEmployeePerformance
);

// Upload employee photo
router.post(
  "/:id/photo",
  authenticateToken,
  authorizeRoles("OWNER", "ADMIN", "MANAGER"),
  upload.single("photo"),
  employeesController.uploadEmployeePhoto
);

export const EmployeeRoutes = router;
