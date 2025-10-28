import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as salarySheetController from "./salarySheetController.js";

const router = express.Router();

router
  .route("/salary-sheets")
  .post(authenticateToken, authorizeRoles("ADMIN", "MANAGER"), salarySheetController.createSalarySheet)
  .get(authenticateToken, authorizeRoles("ADMIN", "MANAGER"), salarySheetController.getAllSalarySheets);

router
  .route("/salary-sheets/:id")
  .put(authenticateToken, authorizeRoles("ADMIN", "MANAGER"), salarySheetController.updateSalarySheet)
  .delete(authenticateToken, authorizeRoles("ADMIN", "MANAGER"), salarySheetController.deleteSalarySheet);

// Get salary sheets for a specific employee
router.get(
  "/salary-sheets/:employeeId",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  salarySheetController.getEmployeeSalarySheets
);

// Mark salary as paid
router.post(
  "/salary-sheets/:id/pay",
  authenticateToken,
  authorizeRoles("ADMIN", "MANAGER"),
  salarySheetController.markSalaryAsPaid
);

export const SalarySheetsRoutes = router;
