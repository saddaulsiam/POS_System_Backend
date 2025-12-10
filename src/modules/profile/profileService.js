import prisma from "../../prisma.js";

export const updateProfile = async (userId, name, username, email, req) => {
  const updateData = {};
  if (name) updateData.name = name.trim();
  if (username) updateData.username = username.trim();
  if (email !== undefined) updateData.email = email ? email.trim() : null;

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

  // Check for email conflict
  if (email) {
    const emailConflict = await prisma.employee.findFirst({
      where: { email: email.trim(), id: { not: userId } },
    });
    if (emailConflict) {
      const error = new Error("Email already in use by another user");
      error.status = 400;
      throw error;
    }
  }

  const updated = await prisma.employee.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      storeId: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  return { updated, updateData };
};
