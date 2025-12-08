import express from "express";
import { authenticateToken, authorizeRoles } from "../../middleware/auth.js";
import * as salarySheetController from "./salarySheetController.js";

const router = express.Router();

router
  .route("/")
  .post(authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), salarySheetController.createSalarySheet)
  .get(authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), salarySheetController.getAllSalarySheets);

router.post(
  "/bulk-generate",
  authenticateToken,
  authorizeRoles("OWNER", "ADMIN", "MANAGER"),
  salarySheetController.bulkGenerateSalarySheets
);

router
  .route("/:id")
  .put(authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), salarySheetController.updateSalarySheet)
  .delete(authenticateToken, authorizeRoles("OWNER", "ADMIN", "MANAGER"), salarySheetController.deleteSalarySheet);

// Get salary sheets for a specific employee
router.get(
  "/:employeeId",
  authenticateToken,
  authorizeRoles("OWNER", "ADMIN", "MANAGER"),
  salarySheetController.getEmployeeSalarySheets
);

// Mark salary as paid
router.post(
  "/:id/pay",
  authenticateToken,
  authorizeRoles("OWNER", "ADMIN", "MANAGER"),
  salarySheetController.markSalaryAsPaid
);

export const SalarySheetsRoutes = router;
