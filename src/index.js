const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const productVariantRoutes = require("./routes/productVariants");
const categoryRoutes = require("./routes/categories");
const customerRoutes = require("./routes/customers");
const salesRoutes = require("./routes/sales");
const inventoryRoutes = require("./routes/inventory");
const reportRoutes = require("./routes/reports");
const suppliersRoutes = require("./routes/suppliers");
const analyticsRoutes = require("./routes/analytics");

const employeeRoutes = require("./routes/employees");
const profileRoutes = require("./routes/profile");
const auditLogsRoutes = require("./routes/auditLogs");
const parkedSalesRoutes = require("./routes/parkedSales");
const quickSaleItemsRoutes = require("./routes/quickSaleItems");
const loyaltyRoutes = require("./routes/loyalty");
const receiptsRoutes = require("./routes/receipts");
const posSettingsRoutes = require("./routes/posSettings");
const cashDrawerRoutes = require("./routes/cashDrawer");
const { startScheduler, stopScheduler } = require("./scheduler");

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
