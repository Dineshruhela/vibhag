import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getGroupBalances(groupId: string) {
  const members = await prisma.groupMember.findMany({
    where: { group_id: groupId },
    include: { user: true }
  });

  const balanceMap: Record<string, number> = {};
  for (const m of members) {
    balanceMap[m.user_id] = 0;
  }

  const payers = await prisma.expensePayer.findMany({
    where: { expense: { group_id: groupId } }
  });
  for (const p of payers) {
    if (balanceMap[p.user_id] !== undefined) {
      balanceMap[p.user_id] += p.amount;
    }
  }

  const shares = await prisma.expenseShare.findMany({
    where: { expense: { group_id: groupId } }
  });
  for (const s of shares) {
    if (balanceMap[s.user_id] !== undefined) {
      balanceMap[s.user_id] -= s.share_amount;
    }
  }

  const settlements = await prisma.settlement.findMany({
    where: { group_id: groupId }
  });
  for (const s of settlements) {
    if (balanceMap[s.payer_id] !== undefined) {
      balanceMap[s.payer_id] += s.amount;
    }
    if (balanceMap[s.payee_id] !== undefined) {
      balanceMap[s.payee_id] -= s.amount;
    }
  }

  return members.map(m => ({
    userId: m.user.id,
    userName: m.user.name,
    userEmail: m.user.email || undefined,
    avatarColor: m.user.avatar_color,
    amount: Math.round((balanceMap[m.user_id] || 0) * 100) / 100
  }));
}

async function getGroupSimplifiedDebts(groupId: string) {
  const balances = await getGroupBalances(groupId);
  const members = await prisma.groupMember.findMany({
    where: { group_id: groupId },
    include: { user: true }
  });
  const memberMap: Record<string, any> = {};
  members.forEach(m => { memberMap[m.user_id] = m.user; });

  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];

  for (const b of balances) {
    if (b.amount > 0.01) {
      creditors.push({ id: b.userId, amount: b.amount });
    } else if (b.amount < -0.01) {
      debtors.push({ id: b.userId, amount: Math.abs(b.amount) });
    }
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const edges: any[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const settle = Math.min(creditors[ci].amount, debtors[di].amount);

    if (settle > 0.01) {
      edges.push({
        from: memberMap[debtors[di].id],
        to: memberMap[creditors[ci].id],
        amount: Math.round(settle * 100) / 100,
      });
    }

    creditors[ci].amount -= settle;
    debtors[di].amount -= settle;

    if (creditors[ci].amount < 0.01) ci++;
    if (debtors[di].amount < 0.01) di++;
  }

  return edges;
}

async function getOverallBalanceBackend(currentUserId: string) {
  const memberships = await prisma.groupMember.findMany({
    where: { user_id: currentUserId },
    select: { group_id: true }
  });
  const groupIds = memberships.map(m => m.group_id);

  const userBalanceMap: Record<string, { name: string; color: string; amount: number }> = {};

  for (const groupId of groupIds) {
    const balances = await getGroupBalances(groupId);
    const myBalance = balances.find(b => b.userId === currentUserId);
    if (!myBalance) continue;

    const debts = await getGroupSimplifiedDebts(groupId);
    for (const debt of debts) {
      if (debt.from.id === currentUserId) {
        const key = debt.to.id;
        if (!userBalanceMap[key]) {
          userBalanceMap[key] = { name: debt.to.name, color: debt.to.avatar_color, amount: 0 };
        }
        userBalanceMap[key].amount -= debt.amount;
      } else if (debt.to.id === currentUserId) {
        const key = debt.from.id;
        if (!userBalanceMap[key]) {
          userBalanceMap[key] = { name: debt.from.name, color: debt.from.avatar_color, amount: 0 };
        }
        userBalanceMap[key].amount += debt.amount;
      }
    }
  }

  let totalOwed = 0;
  let totalOwe = 0;
  const balancesByUser: any[] = [];

  for (const [userId, data] of Object.entries(userBalanceMap)) {
    if (Math.abs(data.amount) > 0.01) {
      if (data.amount > 0) totalOwed += data.amount;
      else totalOwe += Math.abs(data.amount);

      balancesByUser.push({
        userId,
        userName: data.name,
        avatarColor: data.color,
        amount: Math.round(data.amount * 100) / 100
      });
    }
  }

  balancesByUser.sort((a, b) => b.amount - a.amount);

  return {
    totalOwed: Math.round(totalOwed * 100) / 100,
    totalOwe: Math.round(totalOwe * 100) / 100,
    balancesByUser
  };
}

async function run() {
  const userA_id = '0bd6184b-14c7-4ebf-a359-ec842435bdc2'; // Test User
  console.log('Calculating overall balance for User A:', userA_id);
  const balance = await getOverallBalanceBackend(userA_id);
  console.log('Result:', JSON.stringify(balance, null, 2));
  
  const userB_id = '512fc83d-1b80-435a-95fb-8e72ea87df22'; // Antigravity
  console.log('\nCalculating overall balance for User B:', userB_id);
  const balanceB = await getOverallBalanceBackend(userB_id);
  console.log('Result:', JSON.stringify(balanceB, null, 2));

  await prisma.$disconnect();
}

run().catch(console.error);
