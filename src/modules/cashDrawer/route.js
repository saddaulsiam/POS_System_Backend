import { cashDrawerController } from "./cashDrawerController";

router.get("/", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], cashDrawerController.getAll);

router.get("/current", authenticateToken, cashDrawerController.getCurrent);

router.post("/open", authenticateToken, cashDrawerController.openDrawer);

router.post("/close/:id", authenticateToken, cashDrawerController.closeDrawer);

router.get("/:id", authenticateToken, cashDrawerController.getById);

router.get("/:id/reconciliation", authenticateToken, cashDrawerController.getReconciliation);

router.get("/stats/summary", [authenticateToken, authorizeRoles("ADMIN", "MANAGER")], cashDrawerController.getSummary);

export const CashDraRoutes = router;
