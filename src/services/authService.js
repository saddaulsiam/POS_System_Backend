const { PrismaClient } = require("@prisma/client");
const { hashPassword, comparePassword, generateToken, logAudit } = require("../utils/helpers");
const prisma = new PrismaClient();

async function loginService(username, pinCode, req) {
  const employee = await prisma.employee.findUnique({ where: { username } });
  if (!employee || !employee.isActive) {
    return { error: "Invalid credentials or inactive account", status: 401 };
  }
  const isValidPin = await comparePassword(pinCode, employee.pinCode);
  if (!isValidPin) {
    return { error: "Invalid credentials", status: 401 };
  }
  const token = generateToken(employee.id, employee.role);
  await logAudit({
    userId: employee.id,
    action: "LOGIN",
    entity: "Employee",
    entityId: employee.id,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"] || "",
  });
  return {
    token,
    user: {
      id: employee.id,
      name: employee.name,
      username: employee.username,
      role: employee.role,
    },
  };
}

async function getMeService(userId) {
  return await prisma.employee.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true, role: true, isActive: true },
  });
}

async function changePinService(userId, currentPin, newPin) {
  const employee = await prisma.employee.findUnique({ where: { id: userId } });
  if (!employee) {
    return { error: "User not found", status: 404 };
  }
  const isValidCurrentPin = await comparePassword(currentPin, employee.pinCode);
  if (!isValidCurrentPin) {
    return { error: "Current PIN is incorrect", status: 401 };
  }
  const hashedNewPin = await hashPassword(newPin);
  await prisma.employee.update({
    where: { id: userId },
    data: { pinCode: hashedNewPin },
  });
  return { message: "PIN changed successfully" };
}

module.exports = {
  loginService,
  getMeService,
  changePinService,
};
