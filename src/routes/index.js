import { Router } from "express";
import { AnalyticsRoutes } from "../modules/analytics/route.js";
import { AuditLogsRoutes } from "../modules/auditLogs/route.js";
import { AuthRoutes } from "../modules/auth/route.js";
import { CashDrawerRoutes } from "../modules/cashDrawer/route.js";
import { CategoryRoutes } from "../modules/categories/route.js";
import { CustomerRoutes } from "../modules/customers/route.js";
import { EmployeeRoutes } from "../modules/employees/route.js";
import { InventoryRoutes } from "../modules/inventory/route.js";
import { LoyaltyRoutes } from "../modules/loyalty/route.js";
import { NotificationRoutes } from "../modules/notifications/route.js";
import { ParkedSalesRoutes } from "../modules/parkedSales/route.js";
import { PosSettingsRoutes } from "../modules/posSettings/route.js";
import { ProductRoutes } from "../modules/products/route.js";
import { ProductVariantRoutes } from "../modules/productVariants/route.js";
import { ProfileRoutes } from "../modules/profile/route.js";
import { QuickSaleItemsRoutes } from "../modules/quickSaleItems/route.js";
import { ReceiptsRoutes } from "../modules/receipts/route.js";
import { ReportRoutes } from "../modules/reports/route.js";
import { SalarySheetsRoutes } from "../modules/salarySheets/route.js";
import { SalesRoutes } from "../modules/sales/route.js";
import { SuppliersRoutes } from "../modules/suppliers/route.js";

const router = Router();

const moduleRoutes = [
  {
    path: "/notification",
    route: NotificationRoutes,
  },
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/products",
    route: ProductRoutes,
  },
  {
    path: "/product-variants",
    route: ProductVariantRoutes,
  },
  {
    path: "/categories",
    route: CategoryRoutes,
  },
  {
    path: "/customers",
    route: CustomerRoutes,
  },
  {
    path: "/sales",
    route: SalesRoutes,
  },
  {
    path: "/inventory",
    route: InventoryRoutes,
  },
  {
    path: "/reports",
    route: ReportRoutes,
  },
  {
    path: "/suppliers",
    route: SuppliersRoutes,
  },
  {
    path: "/analytics",
    route: AnalyticsRoutes,
  },
  {
    path: "/employees",
    route: EmployeeRoutes,
  },
  {
    path: "/salary-sheets",
    route: SalarySheetsRoutes,
  },
  {
    path: "/profile",
    route: ProfileRoutes,
  },
  {
    path: "/audit-logs",
    route: AuditLogsRoutes,
  },
  {
    path: "/parked-sales",
    route: ParkedSalesRoutes,
  },
  {
    path: "/quick-sale-items",
    route: QuickSaleItemsRoutes,
  },
  {
    path: "/loyalty",
    route: LoyaltyRoutes,
  },
  {
    path: "/receipts",
    route: ReceiptsRoutes,
  },
  {
    path: "/pos-settings",
    route: PosSettingsRoutes,
  },
  {
    path: "/cash-drawer",
    route: CashDrawerRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
