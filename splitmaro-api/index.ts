import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
// Load environment variables
dotenv.config();

// Fix TypeScript error for req.user
interface AuthRequest extends express.Request {
  user?: any;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const prisma = new PrismaClient();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// BigInt Serialization Fix for JSON
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
  socket.on('join', (userId: string) => {
    socket.join(userId);
  });
});

/**
 * Sends a push notification via Expo
 */
async function sendPushNotification(userId: string, title: string, body: string, data: any = {}) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.push_token && user.push_token.startsWith('ExponentPushToken')) {
      await axios.post('https://exp.host/--/api/v2/push/send', {
        to: user.push_token,
        title,
        body,
        data,
        sound: 'default',
      });
    }
  } catch (error) {
    console.error('Push Notification Error:', error);
  }
}

// --- AUTH ROUTES ---

// --- PASSWORD RESET ROUTE ---
app.post('/auth/reset-password', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing required fields' });

  const normalizedEmail = email.toLowerCase().trim();
  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: passwordHash, updated_at: BigInt(Date.now()) }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.post('/auth/signup', async (req, res) => {
  const { name, email, password, push_token } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing required fields' });

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    const passwordHash = await bcrypt.hash(password, 10);

    if (existingUser) {
      // If the user already exists but has no password hash, they were created as a friend.
      // We claim/update this existing user record!
      if (!existingUser.password_hash) {
        const user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            password_hash: passwordHash,
            push_token,
            updated_at: BigInt(Date.now())
          }
        });
        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
        return res.json({ token, user });
      }
      return res.status(400).json({ error: 'User already exists' });
    }

    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name,
        email: normalizedEmail,
        password_hash: passwordHash,
        avatar_color: '#'+Math.floor(Math.random()*16777215).toString(16),
        push_token,
        created_at: BigInt(Date.now()),
        updated_at: BigInt(Date.now()),
      }
    });

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password, push_token } = req.body;
  const normalizedEmail = email ? email.toLowerCase().trim() : '';
  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    if (push_token) {
      await prisma.user.update({ where: { id: user.id }, data: { push_token } });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to login' });
  }
});

// --- USER SEARCH ROUTE (Protected) ---

app.get('/api/users/search', async (req: AuthRequest, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email parameter is required' });

  try {
    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: { email: normalizedEmail }
    });

    if (user) {
      res.json({
        found: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar_color: user.avatar_color
        }
      });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to search user' });
  }
});

app.post('/api/users/search-or-create', async (req: AuthRequest, res) => {
  const { email, name, avatar_color } = req.body;
  if (!email) return res.status(400).json({ error: 'Email parameter is required' });

  try {
    const normalizedEmail = String(email).toLowerCase().trim();
    
    // Check if user exists
    let user = await prisma.user.findFirst({
      where: { email: normalizedEmail }
    });

    if (!user) {
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
      const color = avatar_color || colors[Math.floor(Math.random() * colors.length)];
      
      user = await prisma.user.create({
        data: {
          name: name || email.split('@')[0],
          email: normalizedEmail,
          avatar_color: color,
          is_current_user: 0,
          created_at: BigInt(Date.now()),
          updated_at: BigInt(Date.now())
        }
      });
      console.log(`[Backend] Created placeholder user for email: ${normalizedEmail} with ID: ${user.id}`);
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_color: user.avatar_color,
      phone: user.phone || null,
      upi_id: user.upi_id || null,
      is_pro: user.is_pro || 0,
      is_current_user: user.is_current_user || 0,
      budget_amount: user.budget_amount ? Number(user.budget_amount) : null,
      created_at: Number(user.created_at)
    });
  } catch (error) {
    console.error('[Backend] Search-or-create failed:', error);
    res.status(500).json({ error: 'Failed to search or create user' });
  }
});

// --- SYNC ROUTES (Protected) ---

const authenticateToken = (req: AuthRequest, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

app.post('/api/sync/push', authenticateToken as any, async (req: AuthRequest, res) => {
  const { users, groups, groupMembers, expenses, expensePayers, expenseShares, settlements, comments } = req.body;
  const currentUserId = req.user.userId;

  try {
    // Users
    if (users) {
      for (const u of users) {
        try {
          const { password_hash, push_token, email, ...cleanUser } = u;
          const normalizedEmail = email ? email.toLowerCase().trim() : null;

          if (u.id === currentUserId) {
            await prisma.user.upsert({
              where: { id: u.id },
              update: { ...cleanUser, email: normalizedEmail },
              create: { ...cleanUser, email: normalizedEmail }
            });
          } else {
            // For other users (friends), try to upsert by ID first
            // We store the email to allow them to claim it later when they register
            await prisma.user.upsert({
              where: { id: u.id },
              update: { name: u.name, avatar_color: u.avatar_color, email: normalizedEmail },
              create: { id: u.id, name: u.name, email: normalizedEmail, avatar_color: u.avatar_color, created_at: u.created_at || BigInt(Date.now()), updated_at: u.updated_at || BigInt(Date.now()) }
            });
          }
        } catch (err: any) {
          // General fallback for unique constraint errors
          if (err.code === 'P2002' && err.meta?.target?.includes('email')) {
            console.warn(`[Sync] Skipping user ${u.id} due to duplicate email: ${u.email}`);
            continue;
          }
          throw err;
        }
      }
    }

    let hasActualChanges = false;
    const newExpenses: any[] = [];
    const newMembers: any[] = [];

    // Groups
    if (groups) {
      for (const g of groups) {
        const existing = await prisma.group.findUnique({ where: { id: g.id } });
        if (!existing || Number(existing.updated_at) < Number(g.updated_at)) {
          hasActualChanges = true;
        }
        await prisma.group.upsert({ where: { id: g.id }, update: g, create: g });
      }
    }

    // Members
    if (groupMembers) {
      for (const gm of groupMembers) {
        const existing = await prisma.groupMember.findUnique({
          where: { group_id_user_id: { group_id: gm.group_id, user_id: gm.user_id } }
        });
        if (!existing) {
          hasActualChanges = true;
          newMembers.push(gm);
        }
        try {
          await prisma.groupMember.upsert({
            where: { group_id_user_id: { group_id: gm.group_id, user_id: gm.user_id } },
            // Join table — no updatable fields beyond the composite PK
            update: {},
            create: { group_id: gm.group_id, user_id: gm.user_id }
          });
        } catch (err: any) {
          // P2003 = foreign key constraint failed (group or user not yet on server)
          // Safe to skip — the member row will be retried on the next push after the
          // missing group/user has been synced.
          if (err.code === 'P2003') {
            console.warn(`[Push] Skipping group_member ${gm.group_id}/${gm.user_id}: FK constraint — group or user not found on server yet`);
          } else {
            throw err;
          }
        }
      }
    }

    // Expenses
    if (expenses) {
      for (const e of expenses) {
        const { receipt_url, ...cleanExpense } = e;
        if (receipt_url && !cleanExpense.receipt_uri) {
          cleanExpense.receipt_uri = receipt_url;
        }
        const existing = await prisma.expense.findUnique({ where: { id: e.id } });
        if (!existing) {
          hasActualChanges = true;
          newExpenses.push(e);
        } else if (Number(existing.updated_at) < Number(e.updated_at)) {
          hasActualChanges = true;
        }
        await prisma.expense.upsert({ where: { id: e.id }, update: cleanExpense, create: cleanExpense });
      }
    }

    // Payers & Shares
    if (expensePayers) {
      for (const ep of expensePayers) {
        // Check if user exists before upsert
        const userExists = await prisma.user.findUnique({ where: { id: ep.user_id } });
        if (!userExists) {
          console.warn(`[Push] Skipping expense_payer for missing user: ${ep.user_id}`);
          continue;
        }
        const existing = await prisma.expensePayer.findUnique({
          where: { expense_id_user_id: { expense_id: ep.expense_id, user_id: ep.user_id } }
        });
        if (!existing || existing.amount !== ep.amount) {
          hasActualChanges = true;
        }
        await prisma.expensePayer.upsert({
          where: { expense_id_user_id: { expense_id: ep.expense_id, user_id: ep.user_id } },
          update: ep,
          create: ep
        });
      }
    }
    if (expenseShares) {
      for (const es of expenseShares) {
        const existing = await prisma.expenseShare.findUnique({
          where: { expense_id_user_id: { expense_id: es.expense_id, user_id: es.user_id } }
        });
        if (!existing || existing.share_amount !== es.share_amount) {
          hasActualChanges = true;
        }
        await prisma.expenseShare.upsert({
          where: { expense_id_user_id: { expense_id: es.expense_id, user_id: es.user_id } },
          update: es,
          create: es
        });
      }
    }

    // Settlements & Comments
    if (settlements) {
      for (const s of settlements) {
        const existing = await prisma.settlement.findUnique({ where: { id: s.id } });
        if (!existing) {
          hasActualChanges = true;
        }
        await prisma.settlement.upsert({ where: { id: s.id }, update: s, create: s });
      }
    }
    if (comments) {
      for (const c of comments) {
        const existing = await prisma.expenseComment.findUnique({ where: { id: c.id } });
        if (!existing) {
          hasActualChanges = true;
        }
        await prisma.expenseComment.upsert({ where: { id: c.id }, update: c, create: c });
      }
    }

    // Notify all affected group members in real-time ONLY if actual changes were detected
    if (hasActualChanges) {
      const groupIds = new Set<string>();
      if (groups) groups.forEach((g: any) => groupIds.add(g.id));
      if (groupMembers) groupMembers.forEach((gm: any) => groupIds.add(gm.group_id));
      if (expenses) expenses.forEach((e: any) => groupIds.add(e.group_id));
      if (settlements) settlements.forEach((s: any) => groupIds.add(s.group_id));

      if (groupIds.size > 0) {
        for (const gid of groupIds) {
          const members = await prisma.groupMember.findMany({
            where: { group_id: gid },
            include: { group: true }
          });

          for (const member of members) {
            if (member.user_id !== currentUserId) {
              // Send socket real-time update
              io.to(member.user_id).emit('data_changed', { type: 'sync', groupId: gid });

              // Send push notifications only for truly new additions
              if (newExpenses.length > 0 && newExpenses.some((e: any) => e.group_id === gid)) {
                const expense = newExpenses.find((e: any) => e.group_id === gid);
                sendPushNotification(member.user_id, 'New Expense!', `Someone added "${expense.description}" of ${expense.amount}`);
              } else if (newMembers.length > 0 && newMembers.some((nm: any) => nm.group_id === gid && nm.user_id === member.user_id)) {
                sendPushNotification(member.user_id, 'Added to Group!', `You were added to the group "${member.group?.name || 'New Group'}"`);
              }
            }
          }
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Push Error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

app.get('/api/sync/pull', authenticateToken as any, async (req: AuthRequest, res) => {
  const lastSync = Number(req.query.lastSync || 0);
  const currentUserId = req.user.userId;
  
  try {
    // 1. Resolve all group IDs this user belongs to (used for scoping + reconciliation)
    const userGroupMemberships = await prisma.groupMember.findMany({
      where: { user_id: currentUserId },
      select: { group_id: true }
    });
    const userGroupIds = userGroupMemberships.map(m => m.group_id);

    // 2. Fetch data scoped to the user's groups.
    //    Groups: no timestamp filter — always return all so newly-added groups are never missed
    //    regardless of clock skew between devices.
    const [groups, groupMembers, expenses, settlements, comments] = await Promise.all([
      prisma.group.findMany({ where: { id: { in: userGroupIds } } }),
      prisma.groupMember.findMany({ where: { group_id: { in: userGroupIds } } }),
      prisma.expense.findMany({ where: { group_id: { in: userGroupIds }, updated_at: { gt: lastSync } } }),
      prisma.settlement.findMany({ where: { group_id: { in: userGroupIds }, created_at: { gt: lastSync } } }),
      prisma.expenseComment.findMany({ where: { expense: { group_id: { in: userGroupIds } }, created_at: { gt: lastSync } } }),
    ]);

    // 3. Fetch user profiles for all co-members (only those updated since last sync)
    const users = await prisma.user.findMany({
      where: {
        member_of: { some: { group_id: { in: userGroupIds } } },
        updated_at: { gt: lastSync }
      }
    });

    // 4. Fetch payers and shares only for the expenses returned above
    const expenseIds = expenses.map(e => e.id);
    const [expensePayers, expenseShares] = await Promise.all([
      prisma.expensePayer.findMany({ where: { expense_id: { in: expenseIds } } }),
      prisma.expenseShare.findMany({ where: { expense_id: { in: expenseIds } } }),
    ]);

    res.json({ 
      success: true, 
      data: { 
        users, 
        groups, 
        groupMembers, 
        expenses, 
        expensePayers, 
        expenseShares, 
        settlements, 
        comments,
        activeGroupIds: userGroupIds
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) });
  }
});

// --- REST API ENDPOINTS & HELPER LOGIC ---

async function processRecurringExpensesBackend() {
  const now = Date.now();
  try {
    const parents = await prisma.expense.findMany({
      where: {
        is_recurring_parent: 1,
        NOT: { recurring_type: 'none' }
      }
    });

    for (const parent of parents) {
      const lastGen = Number(parent.recurring_last_generated || parent.created_at);
      const MAX_CATCHUP = parent.recurring_type === 'weekly' ? 52
        : parent.recurring_type === 'monthly' ? 24
        : 10;

      const dueDates: number[] = [];
      let cursor = lastGen;

      for (let i = 0; i < MAX_CATCHUP; i++) {
        const d = new Date(cursor);
        if (parent.recurring_type === 'weekly') d.setDate(d.getDate() + 7);
        else if (parent.recurring_type === 'monthly') d.setMonth(d.getMonth() + 1);
        else if (parent.recurring_type === 'yearly') d.setFullYear(d.getFullYear() + 1);
        const next = d.getTime();
        if (next > now) break;
        dueDates.push(next);
        cursor = next;
      }

      if (dueDates.length === 0) continue;

      const payers = await prisma.expensePayer.findMany({ where: { expense_id: parent.id } });
      const shares = await prisma.expenseShare.findMany({ where: { expense_id: parent.id } });

      for (const dueAt of dueDates) {
        const newId = uuidv4();
        await prisma.expense.create({
          data: {
            id: newId,
            group_id: parent.group_id,
            description: parent.description,
            amount: parent.amount,
            currency: parent.currency || 'INR',
            category: parent.category || 'general',
            split_type: parent.split_type || 'equal',
            receipt_uri: parent.receipt_uri,
            created_by: parent.created_by,
            recurring_type: 'none',
            is_recurring_parent: 0,
            notes: parent.notes,
            created_at: BigInt(dueAt),
            updated_at: BigInt(dueAt),
            payers: {
              create: payers.map(p => ({
                user_id: p.user_id,
                amount: p.amount
              }))
            },
            shares: {
              create: shares.map(s => ({
                user_id: s.user_id,
                share_amount: s.share_amount
              }))
            }
          }
        });
      }

      await prisma.expense.update({
        where: { id: parent.id },
        data: {
          recurring_last_generated: BigInt(dueDates[dueDates.length - 1]),
          updated_at: BigInt(now)
        }
      });
    }
  } catch (err) {
    console.error('[processRecurringExpensesBackend] error:', err);
  }
}

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
    amount: Math.round(balanceMap[m.user_id] * 100) / 100
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

// --- REST ENDPOINTS ---

app.get('/api/users/me', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.put('/api/users/me', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const updates = req.body;
    const cleanUpdates: any = {};
    if (updates.name !== undefined) cleanUpdates.name = updates.name;
    if (updates.email !== undefined) cleanUpdates.email = updates.email ? updates.email.toLowerCase().trim() : null;
    if (updates.phone !== undefined) cleanUpdates.phone = updates.phone;
    if (updates.avatar_color !== undefined) cleanUpdates.avatar_color = updates.avatar_color;
    if (updates.upi_id !== undefined) cleanUpdates.upi_id = updates.upi_id;
    if (updates.is_pro !== undefined) cleanUpdates.is_pro = Number(updates.is_pro);
    if (updates.budget_amount !== undefined) cleanUpdates.budget_amount = updates.budget_amount !== null ? Number(updates.budget_amount) : null;
    
    cleanUpdates.updated_at = BigInt(Date.now());

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: cleanUpdates
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/users/friends', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const friends = await prisma.user.findMany({
      where: {
        id: { not: req.user.userId }
      },
      orderBy: { name: 'asc' }
    });
    res.json(friends);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/users/friends', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { name, email, phone, avatar_color } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const trimmedName = name.trim();
    const trimmedEmail = (typeof email === 'string') ? email.trim().toLowerCase() : null;
    const trimmedPhone = (typeof phone === 'string') ? phone.trim() : null;
    const now = Date.now();

    if (trimmedEmail) {
      const existing = await prisma.user.findFirst({
        where: { email: trimmedEmail }
      });
      if (existing) {
        return res.json(existing);
      }
    }

    const friend = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: trimmedName,
        email: trimmedEmail,
        phone: trimmedPhone,
        avatar_color: avatar_color || '#'+Math.floor(Math.random()*16777215).toString(16),
        created_at: BigInt(now),
        updated_at: BigInt(now)
      }
    });
    res.json(friend);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.delete('/api/users/friends/:id', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    if (id === req.user.userId) return res.status(400).json({ error: 'Cannot delete current user' });
    
    await prisma.user.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/users/:id', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.put('/api/users/:id', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const updates = req.body;
    const cleanUpdates: any = {};
    if (updates.name !== undefined) cleanUpdates.name = updates.name;
    if (updates.email !== undefined) cleanUpdates.email = updates.email ? updates.email.toLowerCase().trim() : null;
    if (updates.phone !== undefined) cleanUpdates.phone = updates.phone;
    if (updates.avatar_color !== undefined) cleanUpdates.avatar_color = updates.avatar_color;
    if (updates.upi_id !== undefined) cleanUpdates.upi_id = updates.upi_id;
    if (updates.is_pro !== undefined) cleanUpdates.is_pro = Number(updates.is_pro);
    if (updates.budget_amount !== undefined) cleanUpdates.budget_amount = updates.budget_amount !== null ? Number(updates.budget_amount) : null;
    
    cleanUpdates.updated_at = BigInt(Date.now());

    const user = await prisma.user.update({
      where: { id },
      data: cleanUpdates
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Groups & Members
app.get('/api/groups', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: {
        members: { some: { user_id: req.user.userId } }
      },
      include: {
        members: true
      },
      orderBy: { updated_at: 'desc' }
    });

    const mapped = groups.map(g => ({
      id: g.id,
      name: g.name,
      category: g.category || 'other',
      cover_image: g.cover_image,
      created_by: g.created_by,
      created_at: Number(g.created_at),
      updated_at: Number(g.updated_at),
      member_count: g.members.length
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/groups/:id', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        members: true
      }
    });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    
    res.json({
      id: group.id,
      name: group.name,
      category: group.category || 'other',
      cover_image: group.cover_image,
      created_by: group.created_by,
      created_at: Number(group.created_at),
      updated_at: Number(group.updated_at),
      member_count: group.members.length
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/groups', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { name, category, memberIds } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const id = uuidv4();
    const now = Date.now();
    const allMemberIds = Array.from(new Set([req.user.userId, ...(memberIds || [])]));

    const group = await prisma.group.create({
      data: {
        id,
        name,
        category: category || 'other',
        created_by: req.user.userId,
        created_at: BigInt(now),
        updated_at: BigInt(now),
        members: {
          create: allMemberIds.map(userId => ({
            user_id: userId
          }))
        }
      }
    });

    res.json({
      id: group.id,
      name: group.name,
      category: group.category || 'other',
      cover_image: group.cover_image,
      created_by: group.created_by,
      created_at: Number(group.created_at),
      updated_at: Number(group.updated_at),
      member_count: allMemberIds.length
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.put('/api/groups/:id', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { name, category } = req.body;
    const group = await prisma.group.update({
      where: { id },
      data: {
        name,
        category,
        updated_at: BigInt(Date.now())
      }
    });
    res.json(group);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.delete('/api/groups/:id', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.group.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/groups/:id/members', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const members = await prisma.groupMember.findMany({
      where: { group_id: id },
      include: { user: true }
    });
    const sorted = members.map(m => m.user).sort((a, b) => {
      if (a.id === req.user.userId) return -1;
      if (b.id === req.user.userId) return 1;
      return a.name.localeCompare(b.name);
    });
    res.json(sorted);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/groups/:id/members', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { userId } = req.body;
    const now = Date.now();
    await prisma.groupMember.upsert({
      where: { group_id_user_id: { group_id: id, user_id: userId } },
      update: {},
      create: { group_id: id, user_id: userId }
    });
    await prisma.group.update({
      where: { id },
      data: { updated_at: BigInt(now) }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.delete('/api/groups/:id/members/:userId', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id, userId } = req.params as { id: string; userId: string };
    await prisma.groupMember.delete({
      where: { group_id_user_id: { group_id: id, user_id: userId } }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Expenses
app.get('/api/groups/:id/expenses', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    await processRecurringExpensesBackend();
    const expenses = await prisma.expense.findMany({
      where: { group_id: id },
      include: { creator: true },
      orderBy: { created_at: 'desc' }
    });

    const mapped = expenses.map(e => ({
      id: e.id,
      group_id: e.group_id,
      description: e.description,
      amount: e.amount,
      currency: e.currency || 'INR',
      category: e.category || 'general',
      split_type: e.split_type || 'equal',
      receipt_uri: e.receipt_uri,
      created_by: e.created_by,
      recurring_type: e.recurring_type,
      recurring_last_generated: e.recurring_last_generated ? Number(e.recurring_last_generated) : null,
      is_recurring_parent: e.is_recurring_parent,
      created_at: Number(e.created_at),
      updated_at: Number(e.updated_at),
      notes: e.notes,
      creator_name: e.creator.name
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/expenses', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    await processRecurringExpensesBackend();
    const expenses = await prisma.expense.findMany({
      where: {
        group: {
          members: { some: { user_id: req.user.userId } }
        }
      },
      include: { creator: true, group: true },
      orderBy: { created_at: 'desc' },
      take: 100
    });

    const mapped = expenses.map(e => ({
      id: e.id,
      group_id: e.group_id,
      description: e.description,
      amount: e.amount,
      currency: e.currency || 'INR',
      category: e.category || 'general',
      split_type: e.split_type || 'equal',
      receipt_uri: e.receipt_uri,
      created_by: e.created_by,
      recurring_type: e.recurring_type,
      recurring_last_generated: e.recurring_last_generated ? Number(e.recurring_last_generated) : null,
      is_recurring_parent: e.is_recurring_parent,
      created_at: Number(e.created_at),
      updated_at: Number(e.updated_at),
      notes: e.notes,
      creator_name: e.creator.name,
      group_name: e.group.name
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/expenses/:id', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { creator: true, group: true }
    });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });

    res.json({
      id: expense.id,
      group_id: expense.group_id,
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency || 'INR',
      category: expense.category || 'general',
      split_type: expense.split_type || 'equal',
      receipt_uri: expense.receipt_uri,
      created_by: expense.created_by,
      recurring_type: expense.recurring_type,
      recurring_last_generated: expense.recurring_last_generated ? Number(expense.recurring_last_generated) : null,
      is_recurring_parent: expense.is_recurring_parent,
      created_at: Number(expense.created_at),
      updated_at: Number(expense.updated_at),
      notes: expense.notes,
      creator_name: expense.creator.name,
      group_name: expense.group.name
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/expenses/:id/payers', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const payers = await prisma.expensePayer.findMany({
      where: { expense_id: id },
      include: { user: true }
    });
    res.json(payers.map(p => ({
      expense_id: p.expense_id,
      user_id: p.user_id,
      amount: p.amount,
      name: p.user.name
    })));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/expenses/:id/shares', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const shares = await prisma.expenseShare.findMany({
      where: { expense_id: id },
      include: { user: true }
    });
    res.json(shares.map(s => ({
      expense_id: s.expense_id,
      user_id: s.user_id,
      share_amount: s.share_amount,
      name: s.user.name
    })));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/groups/:id/expense-details', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const payers = await prisma.expensePayer.findMany({
      where: { expense: { group_id: id } },
      include: { user: true }
    });
    const shares = await prisma.expenseShare.findMany({
      where: { expense: { group_id: id } },
      include: { user: true }
    });

    const payersByExpense: Record<string, any[]> = {};
    for (const p of payers) {
      if (!payersByExpense[p.expense_id]) payersByExpense[p.expense_id] = [];
      payersByExpense[p.expense_id].push({
        expense_id: p.expense_id,
        user_id: p.user_id,
        amount: p.amount,
        name: p.user.name
      });
    }

    const sharesByExpense: Record<string, any[]> = {};
    for (const s of shares) {
      if (!sharesByExpense[s.expense_id]) sharesByExpense[s.expense_id] = [];
      sharesByExpense[s.expense_id].push({
        expense_id: s.expense_id,
        user_id: s.user_id,
        share_amount: s.share_amount,
        name: s.user.name
      });
    }

    res.json({ payersByExpense, sharesByExpense });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/expenses', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const input = req.body;
    const id = uuidv4();
    const now = Date.now();

    await prisma.$transaction(async (tx) => {
      await tx.expense.create({
        data: {
          id,
          group_id: input.groupId,
          description: input.description,
          amount: Number(input.amount),
          currency: input.currency || 'INR',
          category: input.category || 'general',
          split_type: input.splitType || 'equal',
          receipt_uri: input.receiptUri || null,
          created_by: req.user.userId,
          recurring_type: input.recurringType || 'none',
          is_recurring_parent: input.isRecurringParent ? 1 : 0,
          notes: input.notes || null,
          created_at: BigInt(now),
          updated_at: BigInt(now)
        }
      });

      for (const p of input.payers) {
        await tx.expensePayer.create({
          data: {
            expense_id: id,
            user_id: p.userId,
            amount: Number(p.amount)
          }
        });
      }

      for (const s of input.shares) {
        await tx.expenseShare.create({
          data: {
            expense_id: id,
            user_id: s.userId,
            share_amount: Number(s.shareAmount)
          }
        });
      }

      await tx.group.update({
        where: { id: input.groupId },
        data: { updated_at: BigInt(now) }
      });
    });

    res.json(id);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.put('/api/expenses/:id', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const input = req.body;
    const now = Date.now();

    await prisma.$transaction(async (tx) => {
      const expenseUpdates: any = { updated_at: BigInt(now) };
      if (input.description !== undefined) expenseUpdates.description = input.description;
      if (input.amount !== undefined) expenseUpdates.amount = Number(input.amount);
      if (input.currency !== undefined) expenseUpdates.currency = input.currency;
      if (input.category !== undefined) expenseUpdates.category = input.category;
      if (input.notes !== undefined) expenseUpdates.notes = input.notes;
      if (input.receiptUri !== undefined) expenseUpdates.receipt_uri = input.receiptUri;
      if (input.recurringType !== undefined) expenseUpdates.recurring_type = input.recurringType;
      if (input.isRecurringParent !== undefined) expenseUpdates.is_recurring_parent = input.isRecurringParent ? 1 : 0;

      await tx.expense.update({
        where: { id },
        data: expenseUpdates
      });

      if (input.payers) {
        await tx.expensePayer.deleteMany({ where: { expense_id: id } });
        for (const p of input.payers) {
          await tx.expensePayer.create({
            data: {
              expense_id: id,
              user_id: p.userId,
              amount: Number(p.amount)
            }
          });
        }
      }

      if (input.shares) {
        await tx.expenseShare.deleteMany({ where: { expense_id: id } });
        for (const s of input.shares) {
          await tx.expenseShare.create({
            data: {
              expense_id: id,
              user_id: s.userId,
              share_amount: Number(s.shareAmount)
            }
          });
        }
      }

      if (input.groupId) {
        await tx.group.update({
          where: { id: input.groupId },
          data: { updated_at: BigInt(now) }
        });
      }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.delete('/api/expenses/:id', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    await prisma.expense.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Settlements
app.get('/api/groups/:id/settlements', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const settlements = await prisma.settlement.findMany({
      where: { group_id: id },
      include: { payer: true, payee: true, group: true },
      orderBy: { created_at: 'desc' }
    });

    const mapped = settlements.map(s => ({
      id: s.id,
      group_id: s.group_id,
      payer_id: s.payer_id,
      payee_id: s.payee_id,
      amount: s.amount,
      note: s.note,
      created_at: Number(s.created_at),
      payer_name: s.payer.name,
      payee_name: s.payee.name,
      group_name: s.group.name
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/settlements', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { groupId, payerId, payeeId, amount, note } = req.body;
    const id = uuidv4();
    const now = Date.now();

    await prisma.$transaction(async (tx) => {
      await tx.settlement.create({
        data: {
          id,
          group_id: groupId,
          payer_id: payerId,
          payee_id: payeeId,
          amount: Number(amount),
          note: note || null,
          created_at: BigInt(now)
        }
      });

      await tx.group.update({
        where: { id: groupId },
        data: { updated_at: BigInt(now) }
      });
    });

    res.json(id);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Comments
app.get('/api/expenses/:id/comments', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const comments = await prisma.expenseComment.findMany({
      where: { expense_id: id },
      include: { user: true },
      orderBy: { created_at: 'asc' }
    });

    const mapped = comments.map(c => ({
      id: c.id,
      expense_id: c.expense_id,
      user_id: c.user_id,
      text: c.text,
      created_at: Number(c.created_at),
      user_name: c.user.name,
      user_avatar_color: c.user.avatar_color
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/expenses/:id/comments', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const { text } = req.body;
    const commentId = uuidv4();
    const now = Date.now();

    const comment = await prisma.expenseComment.create({
      data: {
        id: commentId,
        expense_id: id,
        user_id: req.user.userId,
        text,
        created_at: BigInt(now)
      },
      include: { user: true }
    });

    res.json({
      id: comment.id,
      expense_id: comment.expense_id,
      user_id: comment.user_id,
      text: comment.text,
      created_at: Number(comment.created_at),
      user_name: comment.user.name,
      user_avatar_color: comment.user.avatar_color
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Search
app.get('/api/expenses/search', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const query = String(req.query.q || '');
    if (!query) return res.json([]);

    const expenses = await prisma.expense.findMany({
      where: {
        group: {
          members: { some: { user_id: req.user.userId } }
        },
        OR: [
          { description: { contains: query, mode: 'insensitive' } },
          { category: { contains: query, mode: 'insensitive' } },
          { group: { name: { contains: query, mode: 'insensitive' } } }
        ]
      },
      include: { creator: true, group: true },
      orderBy: { created_at: 'desc' },
      take: 20
    });

    const mapped = expenses.map(e => ({
      id: e.id,
      group_id: e.group_id,
      description: e.description,
      amount: e.amount,
      currency: e.currency || 'INR',
      category: e.category || 'general',
      split_type: e.split_type || 'equal',
      receipt_uri: e.receipt_uri,
      created_by: e.created_by,
      recurring_type: e.recurring_type,
      recurring_last_generated: e.recurring_last_generated ? Number(e.recurring_last_generated) : null,
      is_recurring_parent: e.is_recurring_parent,
      created_at: Number(e.created_at),
      updated_at: Number(e.updated_at),
      notes: e.notes,
      creator_name: e.creator.name,
      group_name: e.group.name
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Calculations & Analytics
app.get('/api/groups/:id/balances', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const balances = await getGroupBalances(id);
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/groups/:id/simplified-debts', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };
    const debts = await getGroupSimplifiedDebts(id);
    res.json(debts);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/users/me/overall-balance', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const balance = await getOverallBalanceBackend(req.user.userId);
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/users/me/group-balances', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user.userId;
    const memberships = await prisma.groupMember.findMany({
      where: { user_id: currentUserId },
      select: { group_id: true }
    });
    
    const result: Record<string, number> = {};
    for (const membership of memberships) {
      const balances = await getGroupBalances(membership.group_id);
      const myBalance = balances.find(b => b.userId === currentUserId);
      result[membership.group_id] = myBalance ? myBalance.amount : 0;
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});


app.get('/api/users/me/spending-by-category', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (isNaN(month) || isNaN(year)) {
      return res.status(400).json({ error: 'Valid month and year parameters are required' });
    }

    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 1).getTime();

    const shares = await prisma.expenseShare.findMany({
      where: {
        user_id: req.user.userId,
        expense: {
          created_at: {
            gte: BigInt(start),
            lt: BigInt(end)
          }
        }
      },
      include: {
        expense: {
          select: { category: true }
        }
      }
    });

    const categoryMap: Record<string, number> = {};
    for (const s of shares) {
      const cat = s.expense.category || 'general';
      categoryMap[cat] = (categoryMap[cat] || 0) + s.share_amount;
    }

    const result = Object.entries(categoryMap).map(([category, total]) => ({
      category,
      total: Math.round(total * 100) / 100
    })).sort((a, b) => b.total - a.total);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/users/me/monthly-spending', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const lastNMonths = Number(req.query.lastNMonths || 6);
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (lastNMonths - 1), 1).getTime();
    const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

    const shares = await prisma.expenseShare.findMany({
      where: {
        user_id: req.user.userId,
        expense: {
          created_at: {
            gte: BigInt(rangeStart),
            lt: BigInt(rangeEnd)
          }
        }
      },
      select: {
        share_amount: true,
        expense: {
          select: { created_at: true }
        }
      }
    });

    const totalsMap: Record<string, number> = {};
    for (const s of shares) {
      const date = new Date(Number(s.expense.created_at));
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      totalsMap[monthKey] = (totalsMap[monthKey] || 0) + s.share_amount;
    }

    const months: any[] = [];
    for (let i = lastNMonths - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({
        month: monthKey,
        label: monthLabels[d.getMonth()],
        total: totalsMap[monthKey] ? Math.round(totalsMap[monthKey] * 100) / 100 : 0
      });
    }

    res.json(months);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/users/me/total-spending-for-month', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    if (isNaN(month) || isNaN(year)) {
      return res.status(400).json({ error: 'Valid month and year parameters are required' });
    }

    const start = new Date(year, month - 1, 1).getTime();
    const end = new Date(year, month, 1).getTime();

    const result = await prisma.expenseShare.aggregate({
      _sum: {
        share_amount: true
      },
      where: {
        user_id: req.user.userId,
        expense: {
          created_at: {
            gte: BigInt(start),
            lt: BigInt(end)
          }
        }
      }
    });

    const total = result._sum.share_amount || 0;
    res.json(Math.round(total * 100) / 100);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Splitmaro API listening on port ${PORT}`);
});


