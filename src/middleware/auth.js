import jwt from "jsonwebtoken";
import prisma from "../prisma.js";

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const employee = await prisma.employee.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        storeId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!employee || !employee.isActive) {
      return res.status(401).json({ error: "Invalid or inactive user" });
    }
    console.log("[AUTH] employee:", employee);
    console.log("[AUTH] storeId:", employee.storeId);
    if (employee.storeId === null || employee.storeId === undefined) {
      return res.status(403).json({
        error: "Access denied: Your account is not assigned to any store. Please contact your administrator.",
      });
    }
    req.user = employee;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Invalid token" });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

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

export { authenticateToken, authorizeRoles, optionalAuth };
