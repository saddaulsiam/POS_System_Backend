const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  console.log("🔑 Authentication attempt:", {
    hasAuthHeader: !!authHeader,
    hasToken: !!token,
  });

  if (!token) {
    console.log("❌ No token provided");
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("🔓 Token decoded:", { userId: decoded.userId });

    const employee = await prisma.employee.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, username: true, role: true, isActive: true },
    });

    console.log("👤 Employee found:", {
      id: employee?.id,
      username: employee?.username,
      role: employee?.role,
      isActive: employee?.isActive,
    });

    if (!employee || !employee.isActive) {
      console.log("❌ Employee not found or inactive");
      return res.status(401).json({ error: "Invalid or inactive user" });
    }

    req.user = employee;
    console.log("✅ Authentication successful:", employee.username, "-", employee.role);
    next();
  } catch (error) {
    console.log("❌ Token verification failed:", error.message);
    return res.status(403).json({ error: "Invalid token" });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    console.log("🔒 Authorization check:", {
      requiredRoles: roles,
      userRole: req.user?.role,
      userName: req.user?.name,
      userId: req.user?.id,
      hasUser: !!req.user,
    });

    if (!req.user) {
      console.log("❌ No user in request");
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      console.log("❌ Role mismatch:", {
        required: roles,
        actual: req.user.role,
        match: roles.includes(req.user.role),
      });
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    console.log("✅ Authorization passed");
    next();
  };
};

// Optional authentication - doesn't fail if no token, just sets req.user if valid
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const employee = await prisma.employee.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, username: true, role: true, isActive: true },
    });

    if (employee && employee.isActive) {
      req.user = employee;
    } else {
      req.user = null;
    }
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = { authenticateToken, authorizeRoles, optionalAuth };
