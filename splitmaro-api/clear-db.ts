import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDb() {
  console.log('🧹 Clearing Backend database...');
  try {
    // Delete in order to respect Foreign Key constraints
    await prisma.expenseComment.deleteMany();
    await prisma.expenseShare.deleteMany();
    await prisma.expensePayer.deleteMany();
    await prisma.expense.deleteMany();
    await prisma.settlement.deleteMany();
    await prisma.groupMember.deleteMany();
    await prisma.group.deleteMany();
    await prisma.user.deleteMany();
    
    console.log('✅ All data cleared successfully!');
  } catch (error) {
    console.error('❌ Failed to clear database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearDb();
