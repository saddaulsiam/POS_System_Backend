import jwt from "jsonwebtoken";

/**
 * authenticateToken — JWT-only validation (NO database query).
 *
 * The JWT already contains userId, role, storeId, name, email at login time.
 * We trust those claims here. The only time we hit the DB for user data is
 * during login/refresh. This eliminates 1 DB round-trip from EVERY request.
 *
 * Security note: tokens expire (exp claim). If you need to invalidate a token
 * before expiry (e.g. on account deactivation), add a token-revocation check
 * in the login/refresh flow or use short expiry + refresh tokens.
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Populate req.user from the JWT payload — same shape as before.
    req.user = {
      id:        decoded.userId,
      name:      decoded.name      ?? null,
      username:  decoded.username  ?? null,
      email:     decoded.email     ?? null,
      role:      decoded.role,
      storeId:   decoded.storeId   ?? null,
      isActive:  true, // token wouldn't exist if account were inactive at login
    };

    if (
      (req.user.storeId === null || req.user.storeId === undefined) &&
      req.user.role !== "SUPER_ADMIN"
    ) {
      return res.status(403).json({
        error:
          "Access denied: Your account is not assigned to any store. Please contact your administrator.",
      });
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(401).json({ error: "Invalid token" });
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

// Optional authentication — doesn't fail if no token, just sets req.user if valid
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id:       decoded.userId,
      name:     decoded.name     ?? null,
      username: decoded.username ?? null,
      role:     decoded.role,
      storeId:  decoded.storeId  ?? null,
      isActive: true,
    };
  } catch {
    req.user = null;
  }
  next();
};

export { authenticateToken, authorizeRoles, optionalAuth };
