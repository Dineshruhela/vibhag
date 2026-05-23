import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function seed() {
  const userA_email = 'test-1779467324063@example.com';
  const userB_email = 'antigravity@deepmind.com';

  const userA = await prisma.user.findUnique({ where: { email: userA_email } });
  const userB = await prisma.user.findUnique({ where: { email: userB_email } });

  if (!userA || !userB) {
    console.error('Missing userA or userB. Make sure to run check-users or add-antigravity first.');
    return;
  }

  const groupId = uuidv4();
  const now = Date.now();

  console.log('Seeding group with multiple members...');

  // Create Group
  await prisma.group.create({
    data: {
      id: groupId,
      name: 'Shared Trip ✈️',
      category: 'travel',
      created_by: userA.id,
      created_at: BigInt(now),
      updated_at: BigInt(now)
    }
  });

  // Add members
  await prisma.groupMember.createMany({
    data: [
      { group_id: groupId, user_id: userA.id },
      { group_id: groupId, user_id: userB.id }
    ]
  });

  // Create Expense (User A paid 1000, split equally between User A and User B)
  const expenseId = uuidv4();
  await prisma.expense.create({
    data: {
      id: expenseId,
      group_id: groupId,
      description: 'Hotel Accommodation',
      amount: 1000.0,
      currency: 'INR',
      category: 'lodging',
      split_type: 'equal',
      created_by: userA.id,
      created_at: BigInt(now),
      updated_at: BigInt(now)
    }
  });

  // Payers: User A paid 1000
  await prisma.expensePayer.create({
    data: {
      expense_id: expenseId,
      user_id: userA.id,
      amount: 1000.0
    }
  });

  // Shares: User A share 500, User B share 500
  await prisma.expenseShare.createMany({
    data: [
      { expense_id: expenseId, user_id: userA.id, share_amount: 500.0 },
      { expense_id: expenseId, user_id: userB.id, share_amount: 500.0 }
    ]
  });

  console.log(`Successfully seeded Shared Trip group (${groupId}) with 2 members and 1000 INR expense.`);
  await prisma.$disconnect();
}

seed().catch(console.error);
