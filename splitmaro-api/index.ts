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

const PORT = process.env.PORT || 3000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Splitmaro API listening on port ${PORT}`);
});
