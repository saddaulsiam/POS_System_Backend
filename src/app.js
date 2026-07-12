import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import prisma from "./prisma.js";
import router from "./routes/index.js";
import { startScheduler, stopScheduler } from "./scripts/scheduler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

const app = express();

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "http://localhost:3000",
      "http://localhost:4173",
      "https://smartpossystem.vercel.app",
      "file://",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Silent-Error", "x-silent-error"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    optionsSuccessStatus: 200,
  }),
);
// 'tiny' in production: less I/O, faster request logging
app.use(morgan(process.env.NODE_ENV === "production" ? "tiny" : "dev"));
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

// Handle preflight requests for all routes
app.options("*", cors());

// API routes
app.use("/api", router);

// ── Keep-alive endpoint (no DB, responds in <1ms) ────────────────────────────
// Point an uptime monitor (e.g. cron-job.org) to GET /ping every 14 minutes
// to prevent Render free-tier from sleeping (which causes the 85s cold start).
//
// Setup (free): https://cron-job.org → New Job → URL: https://<your-render-url>/ping
// → Every 14 minutes. That's it.
app.get("/ping", (req, res) => res.send("pong"));

// Health check (with DB connectivity verification)
app.get("/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "OK", db: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "degraded", db: "unreachable", timestamp: new Date().toISOString() });
  }
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

// Pre-warm the DB connection BEFORE the server accepts any traffic.
// Without this, the very first user request pays the full Neon cold-start penalty.
prisma.$connect()
  .then(() => console.log("✅ Database connected."))
  .catch((err) => console.error("❌ DB pre-connect failed:", err.message));


app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
  startScheduler();

  // ── Self-ping keep-alive (Render free-tier workaround) ───────────────────
  // Render spins down free services after 15 min of inactivity → 85s cold start.
  // This pings our own /ping endpoint every 14 minutes to stay awake.
  // Only runs in production so it doesn't pollute local dev logs.
  if (process.env.NODE_ENV === "production" && process.env.RENDER_EXTERNAL_URL) {
    const PING_URL = `${process.env.RENDER_EXTERNAL_URL}/ping`;
    const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes

    setInterval(async () => {
      try {
        await fetch(PING_URL);
        console.log(`🏓 Self-ping OK → ${PING_URL}`);
      } catch (err) {
        console.warn(`⚠️  Self-ping failed: ${err.message}`);
      }
    }, INTERVAL_MS);

    console.log(`🏓 Keep-alive self-ping active (every 14 min) → ${PING_URL}`);
  }
});

export default app;
