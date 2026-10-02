import prisma from './src/prisma.js';
async function test() {
  try {
    const res = await prisma.expenseCategory.findMany();
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
test();
