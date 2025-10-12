import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import productVariantRoutes from "./routes/productVariants.js";
import categoryRoutes from "./routes/categories.js";
import customerRoutes from "./routes/customers.js";
import salesRoutes from "./routes/sales.js";
import inventoryRoutes from "./routes/inventory.js";
import reportRoutes from "./routes/reports.js";
import suppliersRoutes from "./routes/suppliers.js";
import analyticsRoutes from "./routes/analytics.js";
import employeeRoutes from "./routes/employees.js";
import profileRoutes from "./routes/profile.js";
import auditLogsRoutes from "./routes/auditLogs.js";
import parkedSalesRoutes from "./routes/parkedSales.js";
import quickSaleItemsRoutes from "./routes/quickSaleItems.js";
import loyaltyRoutes from "./routes/loyalty.js";
import receiptsRoutes from "./routes/receipts.js";
import posSettingsRoutes from "./routes/posSettings.js";

import cashDrawerRoutes from "./routes/cashDrawer.js";
import { startScheduler, stopScheduler } from "./scheduler.js";

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin image loading
  })
);
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for debugging)
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/product-variants", productVariantRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/audit-logs", auditLogsRoutes);
app.use("/api/parked-sales", parkedSalesRoutes);
app.use("/api/quick-sale-items", quickSaleItemsRoutes);
app.use("/api/loyalty", loyaltyRoutes);
app.use("/api/receipts", receiptsRoutes);
app.use("/api/pos-settings", posSettingsRoutes);
app.use("/api/cash-drawer", cashDrawerRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5000;

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down gracefully...");
  await stopScheduler(); // Stop birthday rewards scheduler
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);

  // Start birthday rewards automation
  startScheduler();
});

export default app;
