const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkDateFormat() {
  const result = await prisma.$queryRaw`
    SELECT id, name, dateOfBirth, 
           strftime('%Y-%m-%d', dateOfBirth) as formatted,
           strftime('%m', dateOfBirth) as month,
           strftime('%d', dateOfBirth) as day
    FROM Customer 
    WHERE dateOfBirth IS NOT NULL 
    LIMIT 3
  `;

  console.log(JSON.stringify(result, null, 2));

  await prisma.$disconnect();
}

checkDateFormat();
