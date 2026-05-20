import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: { email: true, name: true }
  });
  console.log('Current Users in DB:', users);
  await prisma.$disconnect();
}

checkUsers();
