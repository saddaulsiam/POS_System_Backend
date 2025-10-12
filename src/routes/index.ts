import { Router } from "express";
import analyticsRoutes from "../modules/analytics/route.js";
import auditLogsRoutes from "../modules/auditLogs/route.js";
import { AuthRoutes } from "../modules/auth/route";
import cashDrawerRoutes from "../modules/cashDrawer/route.js";
import categoryRoutes from "../modules/categories/route.js";
import customerRoutes from "../modules/customers/route.js";
import employeeRoutes from "../modules/employees/route.js";
import inventoryRoutes from "../modules/inventory/route.js";
import loyaltyRoutes from "../modules/loyalty/route.js";
import parkedSalesRoutes from "../modules/parkedSales/route.js";
import posSettingsRoutes from "../modules/posSettings/route.js";
import productRoutes from "../modules/products/route.js";
import productVariantRoutes from "../modules/productVariants/route.js";
import profileRoutes from "../modules/profile/route.js";
import quickSaleItemsRoutes from "../modules/quickSaleItems/route.js";
import receiptsRoutes from "../modules/receipts/route.js";
import reportRoutes from "../modules/reports/route.js";
import salesRoutes from "../modules/sales/route.js";
import suppliersRoutes from "../modules/suppliers/route.js";

const router = Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/products",
    route: productRoutes,
  },
  {
    path: "/product-variants",
    route: productVariantRoutes,
  },
  {
    path: "/categories",
    route: categoryRoutes,
  },
  {
    path: "/customers",
    route: customerRoutes,
  },
  {
    path: "/sales",
    route: salesRoutes,
  },
  {
    path: "/inventory",
    route: inventoryRoutes,
  },
  {
    path: "/reports",
    route: reportRoutes,
  },
  {
    path: "/suppliers",
    route: suppliersRoutes,
  },
  {
    path: "/analytics",
    route: analyticsRoutes,
  },
  {
    path: "/employees",
    route: employeeRoutes,
  },
  {
    path: "/profile",
    route: profileRoutes,
  },
  {
    path: "/audit-logs",
    route: auditLogsRoutes,
  },
  {
    path: "/parked-sales",
    route: parkedSalesRoutes,
  },
  {
    path: "/quick-sale-items",
    route: quickSaleItemsRoutes,
  },
  {
    path: "/loyalty",
    route: loyaltyRoutes,
  },
  {
    path: "/receipts",
    route: receiptsRoutes,
  },
  {
    path: "/pos-settings",
    route: posSettingsRoutes,
  },
  {
    path: "/cash-drawer",
    route: cashDrawerRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
