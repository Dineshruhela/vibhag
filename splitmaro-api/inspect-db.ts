import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspect() {
  const users = await prisma.user.findMany();
  console.log('--- USERS ---');
  users.forEach(u => {
    console.log(`User ID: ${u.id} | Name: ${u.name} | Email: ${u.email} | Current: ${u.is_current_user}`);
  });

  const groups = await prisma.group.findMany({
    include: {
      members: {
        include: {
          user: true
        }
      }
    }
  });
  console.log('\n--- GROUPS ---');
  groups.forEach(g => {
    console.log(`Group ID: ${g.id} | Name: ${g.name} | Members Count: ${g.members.length}`);
    g.members.forEach(m => {
      console.log(`  - Member: ${m.user.name} (${m.user.email})`);
    });
  });

  const expenses = await prisma.expense.findMany({
    include: {
      payers: true,
      shares: true
    }
  });
  console.log('\n--- EXPENSES ---');
  expenses.forEach(e => {
    console.log(`Expense ID: ${e.id} | Desc: ${e.description} | Amount: ${e.amount} | Group ID: ${e.group_id}`);
    console.log('  Payers:', e.payers.map(p => `User: ${p.user_id}, Amt: ${p.amount}`));
    console.log('  Shares:', e.shares.map(s => `User: ${s.user_id}, Share: ${s.share_amount}`));
  });

  const settlements = await prisma.settlement.findMany();
  console.log('\n--- SETTLEMENTS ---');
  settlements.forEach(s => {
    console.log(`Settlement ID: ${s.id} | Amount: ${s.amount} | Payer: ${s.payer_id} -> Payee: ${s.payee_id}`);
  });

  await prisma.$disconnect();
}

inspect().catch(console.error);
