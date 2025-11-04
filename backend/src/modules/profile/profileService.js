import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export const updateProfile = async (userId, name, username, req) => {
  const updateData = {};
  if (name) updateData.name = name.trim();
  if (username) updateData.username = username.trim();
  // Check for username conflict
  if (username) {
    const conflict = await prisma.employee.findFirst({
      where: { username: username.trim(), id: { not: userId } },
    });
    if (conflict) {
      const error = new Error("Username already taken by another user");
      error.status = 400;
      throw error;
    }
  }
  const updated = await prisma.employee.update({
    where: { id: userId },
    data: updateData,
    select: { id: true, name: true, username: true, role: true, isActive: true, updatedAt: true },
  });
  return { updated, updateData };
};
