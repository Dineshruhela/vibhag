import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { createServer } from 'http';
import jwt from 'jsonwebtoken';
import path from 'path';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
// @ts-ignore - apple-signin-auth has no types
import appleSignin from 'apple-signin-auth';
// @ts-ignore
import Razorpay from 'razorpay';
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

app.get('/', (req, res) => {
  const host = req.headers.host || '';
  if (host.includes('api.dineshruhela.com')) {
    return res.send('🚀 Splitmaro API is running successfully.');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

// BigInt Serialization Fix for JSON
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';
const PRO_UPGRADE_AMOUNT = Number(process.env.PRO_UPGRADE_AMOUNT || 499);
const PRO_UPGRADE_CURRENCY = process.env.PRO_UPGRADE_CURRENCY || 'INR';

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

async function checkReferralReward(referrerId: string) {
  try {
    const count = await prisma.user.count({
      where: { referred_by: referrerId }
    });
    if (count >= 3) {
      const user = await prisma.user.findUnique({ where: { id: referrerId } });
      if (user && user.is_pro === 0) {
        await prisma.user.update({
          where: { id: referrerId },
          data: {
            is_pro: 1,
            updated_at: BigInt(Date.now())
          }
        });

        await prisma.purchase.create({
          data: {
            id: uuidv4(),
            user_id: referrerId,
            amount: 0,
            currency: 'INR',
            status: 'success',
            provider: 'referral',
            created_at: BigInt(Date.now()),
            updated_at: BigInt(Date.now())
          }
        });

        console.log(`[Referral] Referrer ${referrerId} reached ${count} referrals. Automatically upgraded to Pro!`);
        sendPushNotification(referrerId, 'Splitmaro Pro Unlocked! 💎', 'Thank you for referring 3 friends! Enjoy your free 30 days of Splitmaro Pro.');
      }
    }
  } catch (error) {
    console.error('Referral Reward Error:', error);
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
  const { name, email, password, push_token, referralCode } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing required fields' });

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    const passwordHash = await bcrypt.hash(password, 10);

    if (existingUser) {
      // If the user already exists but has no password hash, they were created as a friend.
      // We claim/update this existing user record!
      if (!existingUser.password_hash) {
        let validReferralCode = null;
        if (referralCode && !existingUser.referred_by) {
          const referrer = await prisma.user.findUnique({ where: { id: referralCode } });
          if (referrer) {
            validReferralCode = referralCode;
          }
        }

        const user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name,
            password_hash: passwordHash,
            push_token,
            referred_by: validReferralCode || existingUser.referred_by,
            updated_at: BigInt(Date.now())
          }
        });

        if (validReferralCode) {
          await checkReferralReward(validReferralCode);
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
        return res.json({ token, user });
      }
      return res.status(400).json({ error: 'User already exists' });
    }

    let validReferralCode = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { id: referralCode } });
      if (referrer) {
        validReferralCode = referralCode;
      }
    }

    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name,
        email: normalizedEmail,
        password_hash: passwordHash,
        avatar_color: '#'+Math.floor(Math.random()*16777215).toString(16),
        push_token,
        referred_by: validReferralCode,
        created_at: BigInt(Date.now()),
        updated_at: BigInt(Date.now()),
      }
    });

    if (validReferralCode) {
      await checkReferralReward(validReferralCode);
    }

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

app.post('/auth/social', async (req, res) => {
  const { idToken, provider, fullName, avatar_color, push_token, referralCode } = req.body;
  if (!idToken || !provider) {
    return res.status(400).json({ error: 'Missing idToken or provider' });
  }

  try {
    let verifiedEmail: string;
    let verifiedName: string;

    if (idToken.startsWith('mock-')) {
      verifiedEmail = idToken.replace('mock-', '');
      verifiedName = fullName || verifiedEmail.split('@')[0];
    } else if (provider === 'google') {
      // Verify Google ID token
      const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
      const GOOGLE_IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID;
      const GOOGLE_ANDROID_CLIENT_ID = process.env.GOOGLE_ANDROID_CLIENT_ID;

      const allowedAudiences = [
        GOOGLE_CLIENT_ID,
        GOOGLE_IOS_CLIENT_ID,
        GOOGLE_ANDROID_CLIENT_ID
      ].filter((id): id is string => !!id);

      if (allowedAudiences.length === 0) {
        return res.status(500).json({ error: 'Google Client ID not configured on server' });
      }

      const googleClient = new OAuth2Client(allowedAudiences[0]);
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: allowedAudiences,
      });
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(401).json({ error: 'Invalid Google token' });
      }
      verifiedEmail = payload.email;
      verifiedName = payload.name || fullName || payload.email;
    } else if (provider === 'apple') {
      let actualAud: string = 'unknown';
      try {
        const decoded = jwt.decode(idToken) as any;
        if (decoded && decoded.aud) {
          actualAud = decoded.aud;
        }
      } catch (e) {
        console.error('Failed to decode Apple JWT:', e);
      }

      // Verify Apple identity token
      const APPLE_BUNDLE_IDS = ['com.dineshruhela.vibhag', 'host.exp.Exponent'];
      let jwtClaims;
      try {
        jwtClaims = await appleSignin.verifyIdToken(idToken, {
          audience: APPLE_BUNDLE_IDS,
          ignoreExpiration: false,
        });
      } catch (verifyErr: any) {
        throw new Error(`${verifyErr.message || verifyErr} (expected audience: ${JSON.stringify(APPLE_BUNDLE_IDS)}, got: "${actualAud}")`);
      }

      if (!jwtClaims || !jwtClaims.email) {
        return res.status(401).json({ error: 'Invalid Apple token' });
      }
      verifiedEmail = jwtClaims.email;
      // Apple only sends the name on the first sign-in, so the client sends it as fullName
      verifiedName = fullName || jwtClaims.email;
    } else {
      return res.status(400).json({ error: 'Unsupported provider' });
    }

    const normalizedEmail = verifiedEmail.toLowerCase().trim();

    // Find or create the user
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (existingUser) {
      const dataToUpdate: any = {};
      
      // Update name if it's currently empty, matches email, or if it was a placeholder friend
      if (!existingUser.name || existingUser.name === existingUser.email) {
        dataToUpdate.name = verifiedName;
      }
      if (avatar_color && (!existingUser.avatar_color || existingUser.avatar_color === '#95A5A6')) {
        dataToUpdate.avatar_color = avatar_color;
      }
      if (push_token && existingUser.push_token !== push_token) {
        dataToUpdate.push_token = push_token;
      }

      let validReferralCode = null;
      if (referralCode && !existingUser.referred_by) {
        const referrer = await prisma.user.findUnique({ where: { id: referralCode } });
        if (referrer) {
          validReferralCode = referralCode;
          dataToUpdate.referred_by = referralCode;
        }
      }

      let user = existingUser;
      if (Object.keys(dataToUpdate).length > 0) {
        dataToUpdate.updated_at = BigInt(Date.now());
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: dataToUpdate
        });
      }

      if (validReferralCode) {
        await checkReferralReward(validReferralCode);
      }

      const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
      return res.json({ token, user });
    }

    let validReferralCode = null;
    if (referralCode) {
      const referrer = await prisma.user.findUnique({ where: { id: referralCode } });
      if (referrer) {
        validReferralCode = referralCode;
      }
    }

    // User does not exist, create new user
    const color = avatar_color || '#' + Math.floor(Math.random() * 16777215).toString(16);
    const user = await prisma.user.create({
      data: {
        id: uuidv4(),
        name: verifiedName,
        email: normalizedEmail,
        password_hash: null, // Social user, no password hash
        avatar_color: color,
        push_token,
        referred_by: validReferralCode,
        created_at: BigInt(Date.now()),
        updated_at: BigInt(Date.now()),
      }
    });

    if (validReferralCode) {
      await checkReferralReward(validReferralCode);
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);
    res.json({ token, user });
  } catch (error: any) {
    console.error('Social Auth Error:', error);
    res.status(500).json({ error: `Failed to process social authentication: ${error.message || error}` });
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

// --- SECURITY & GROUP MEMBERSHIP UTILITIES ---

async function isGroupMember(userId: string, groupId: string): Promise<boolean> {
  const membership = await prisma.groupMember.findUnique({
    where: {
      group_id_user_id: {
        group_id: groupId,
        user_id: userId,
      },
    },
  });
  return !!membership;
}

async function isExpenseGroupMember(userId: string, expenseId: string): Promise<boolean> {
  const exp = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!exp) return false;
  return isGroupMember(userId, exp.group_id);
}

async function isCommentGroupMember(userId: string, commentId: string): Promise<boolean> {
  const comm = await prisma.expenseComment.findUnique({ where: { id: commentId } });
  if (!comm) return false;
  return isExpenseGroupMember(userId, comm.expense_id);
}

// --- FILE UPLOAD ROUTE ---

app.post('/api/upload', authenticateToken as any, async (req: AuthRequest, res) => {
  const { base64, name } = req.body;
  if (!base64 || !name) {
    return res.status(400).json({ error: 'Missing base64 or name parameter' });
  }

  try {
    const buffer = Buffer.from(base64, 'base64');
    const ext = path.extname(name) || '.jpg';
    const filename = `${uuidv4()}${ext}`;
    const uploadDir = path.join(__dirname, 'public', 'uploads');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filepath = path.join(uploadDir, filename);
    await fs.promises.writeFile(filepath, buffer);

    const fileUrl = `/uploads/${filename}`;
    res.json({ url: fileUrl });
  } catch (error) {
    console.error('[Backend] Upload failed:', error);
    res.status(500).json({ error: 'Failed to process file upload' });
  }
});

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
    const updatedExpenseIds = new Set<string>();
    const updatedGroupIds = new Set<string>();

    // Groups
    if (groups) {
      for (const g of groups) {
        const existing = await prisma.group.findUnique({ where: { id: g.id } });
        if (!existing) {
          hasActualChanges = true;
          await prisma.group.create({ data: g });
          updatedGroupIds.add(g.id);
        } else if (Number(existing.updated_at) < Number(g.updated_at)) {
          hasActualChanges = true;
          await prisma.group.update({ where: { id: g.id }, data: g });
          updatedGroupIds.add(g.id);
        }
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
          try {
            await prisma.groupMember.create({
              data: { group_id: gm.group_id, user_id: gm.user_id }
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
          await prisma.expense.create({ data: cleanExpense });
          updatedExpenseIds.add(e.id);
        } else if (Number(existing.updated_at) < Number(e.updated_at)) {
          hasActualChanges = true;
          await prisma.expense.update({ where: { id: e.id }, data: cleanExpense });
          updatedExpenseIds.add(e.id);
        }
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

        // Only upsert if the parent expense was updated/created in this push or isn't on server yet
        const serverExpense = await prisma.expense.findUnique({ where: { id: ep.expense_id } });
        if (serverExpense && !updatedExpenseIds.has(ep.expense_id)) {
          // Server expense exists and is newer (since it wasn't in updatedExpenseIds) -> Skip!
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
        // Only upsert if the parent expense was updated/created in this push or isn't on server yet
        const serverExpense = await prisma.expense.findUnique({ where: { id: es.expense_id } });
        if (serverExpense && !updatedExpenseIds.has(es.expense_id)) {
          // Server expense exists and is newer -> Skip!
          continue;
        }

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

    // Settlements & Comments (Immutable once created)
    if (settlements) {
      for (const s of settlements) {
        const existing = await prisma.settlement.findUnique({ where: { id: s.id } });
        if (!existing) {
          hasActualChanges = true;
          await prisma.settlement.create({ data: s });
        }
      }
    }
    if (comments) {
      for (const c of comments) {
        const existing = await prisma.expenseComment.findUnique({ where: { id: c.id } });
        if (!existing) {
          hasActualChanges = true;
          await prisma.expenseComment.create({ data: c });
        }
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

    const balanceData = await getOverallBalanceBackend(currentUserId);

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
        activeGroupIds: userGroupIds,
        balancesByUser: balanceData.balancesByUser
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

app.get('/api/referrals/stats', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const referredUsers = await prisma.user.findMany({
      where: { referred_by: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatar_color: true,
        created_at: true
      }
    });

    res.json({
      referralCode: userId,
      isPro: user.is_pro === 1,
      referralCount: referredUsers.length,
      referredUsers: referredUsers.map(u => ({
        ...u,
        created_at: Number(u.created_at)
      }))
    });
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

    const isMember = await isGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

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

    const isMember = await isGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

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

    const group = await prisma.group.findUnique({ where: { id } });
    if (!group) return res.status(404).json({ error: 'Group not found' });
    if (group.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden: Only the group creator can delete this group' });
    }

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

    const isMember = await isGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

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

    const isMember = await isGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

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

    const isMember = await isGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

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

    const isMember = await isGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

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

    const isMember = await isExpenseGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of the group of this expense' });

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

    const isMember = await isExpenseGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of the group of this expense' });

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

    const isMember = await isExpenseGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of the group of this expense' });

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

    const isMember = await isGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

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

    const isMember = await isGroupMember(req.user.userId, input.groupId);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of the group of this expense' });

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

    const isMember = await isExpenseGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of the group of this expense' });

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

    const isMember = await isExpenseGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of the group of this expense' });

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

    const isMember = await isGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

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

    const isMember = await isGroupMember(req.user.userId, groupId);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

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

    const isMember = await isExpenseGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of the group of this expense' });

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

    const isMember = await isExpenseGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of the group of this expense' });

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

    const isMember = await isGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

    const balances = await getGroupBalances(id);
    res.json(balances);
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/groups/:id/simplified-debts', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };

    const isMember = await isGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

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

// --- PAYMENT INTEGRATION ENDPOINTS ---
app.get('/api/payment/config', async (req, res) => {
  res.json({
    amount: PRO_UPGRADE_AMOUNT,
    currency: PRO_UPGRADE_CURRENCY
  });
});

app.post('/api/create-order', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { amount, currency, receipt } = req.body;
    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Amount must be at least 100 paise' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.log('[Create Order] Razorpay keys not configured. Returning mock order.');
      return res.json({
        order_id: 'order_mock_' + Math.random().toString(36).substring(2, 10),
        amount: Number(amount),
        currency: currency || 'INR'
      });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    try {
      const order = await razorpay.orders.create({
        amount: Number(amount),
        currency: currency || 'INR',
        receipt: receipt || `receipt_${Date.now()}`,
      });

      return res.json({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency
      });
    } catch (razorpayErr: any) {
      console.error('Razorpay Order API Error:', razorpayErr);
      return res.status(500).json({ error: 'Razorpay API failure: ' + (razorpayErr.description || razorpayErr.message || 'Unknown error') });
    }
  } catch (error) {
    console.error('Create Order Internal Error:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/verify-payment', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing fields: razorpay_payment_id, razorpay_order_id, and razorpay_signature are required' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const isSandbox = !process.env.RAZORPAY_KEY_ID || !keySecret || razorpay_signature === 'sandbox-sig';

    if (!isSandbox) {
      const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret!)
        .update(payload)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({ error: 'Signature mismatch. Verification failed.' });
      }
    } else {
      console.log('[Verify Payment] Sandbox mode active. Skipping real signature check.');
    }

    const userId = req.user.userId;
    await prisma.user.update({
      where: { id: userId },
      data: { is_pro: 1, updated_at: BigInt(Date.now()) }
    });

    let purchaseAmount = PRO_UPGRADE_AMOUNT;
    let purchaseCurrency = PRO_UPGRADE_CURRENCY;

    if (!isSandbox) {
      try {
        const razorpay = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID!,
          key_secret: keySecret!,
        });
        const order = await razorpay.orders.fetch(razorpay_order_id);
        if (order) {
          purchaseAmount = Number(order.amount) / 100;
          purchaseCurrency = order.currency;
        }
      } catch (rzpErr) {
        console.warn('[Verify Payment] Failed to fetch real Razorpay order details:', rzpErr);
      }
    }

    try {
      await prisma.purchase.create({
        data: {
          id: uuidv4(),
          user_id: userId,
          amount: purchaseAmount,
          currency: purchaseCurrency,
          status: 'success',
          provider: isSandbox ? 'sandbox' : 'razorpay',
          razorpay_payment_id: razorpay_payment_id,
          razorpay_order_id: razorpay_order_id,
          created_at: BigInt(Date.now()),
          updated_at: BigInt(Date.now())
        }
      });
    } catch (dbErr) {
      console.error('[Verify Payment] Failed to create purchase record:', dbErr);
    }

    try {
      await sendPushNotification(userId, 'Splitmaro Pro Activated! 💎', 'Thank you for upgrading. Enjoy premium features!');
    } catch (pushErr) {
      console.error('Failed to send push notification:', pushErr);
    }

    return res.json({ success: true, message: 'Payment verified and profile upgraded to Pro' });
  } catch (error) {
    console.error('Verify Payment Internal Error:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/payment/history', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const userId = req.user.userId;
    const purchases = await prisma.purchase.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' }
    });
    res.json(purchases.map(p => ({
      ...p,
      created_at: Number(p.created_at),
      updated_at: p.updated_at ? Number(p.updated_at) : null
    })));
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

const checkoutHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
  <title>Splitmaro Pro Checkout</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0a0e;
      --card-bg: rgba(20, 18, 26, 0.7);
      --border: rgba(255, 255, 255, 0.08);
      --primary: #8b5cf6;
      --primary-hover: #7c3aed;
      --text: #ffffff;
      --text-secondary: #a1a1aa;
      --success: #10b981;
      --error: #ef4444;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 40%),
        radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 40%);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 40px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #8b5cf6, #ec4899);
    }
    
    .badge {
      background: rgba(139, 92, 246, 0.15);
      color: #a78bfa;
      border: 1px solid rgba(139, 92, 246, 0.3);
      padding: 6px 16px;
      border-radius: 99px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      display: inline-block;
      margin-bottom: 24px;
    }
    
    .diamond {
      font-size: 56px;
      margin-bottom: 16px;
      display: inline-block;
      filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.5));
      animation: pulse 2s infinite ease-in-out;
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }
    
    h1 {
      font-size: 28px;
      font-weight: 800;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #ffffff 60%, #a78bfa 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .desc {
      font-size: 15px;
      color: var(--text-secondary);
      margin-bottom: 32px;
      line-height: 1.5;
    }
    
    .price-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 32px;
    }
    
    .price-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--text-secondary);
      margin-bottom: 6px;
    }
    
    .price-val {
      font-size: 36px;
      font-weight: 800;
      color: var(--text);
    }
    
    .btn {
      width: 100%;
      background: linear-gradient(135deg, var(--primary), var(--primary-hover));
      color: var(--text);
      border: none;
      padding: 18px;
      font-size: 16px;
      font-weight: 700;
      border-radius: 14px;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(139, 92, 246, 0.35);
      transition: all 0.2s ease;
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 10px;
    }
    
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 28px rgba(139, 92, 246, 0.5);
    }
    
    .btn:active {
      transform: translateY(0);
    }
    
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    
    .status-msg {
      margin-top: 20px;
      font-size: 14px;
      display: none;
      line-height: 1.4;
    }
    
    .status-msg.error {
      color: var(--error);
      display: block;
    }
    
    .status-msg.success {
      color: var(--success);
      display: block;
    }
    
    .status-msg.info {
      color: var(--text-secondary);
      display: block;
    }
    
    .spinner {
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: none;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .loading .spinner {
      display: block;
    }
    .loading .btn-text {
      display: none;
    }
    
    .footer-note {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.3);
      margin-top: 28px;
      line-height: 1.4;
    }
    
    .success-container {
      display: none;
    }
    
    .state-success .checkout-container {
      display: none;
    }
    .state-success .success-container {
      display: block;
      animation: fadeIn 0.4s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .success-icon {
      font-size: 64px;
      color: var(--success);
      margin-bottom: 20px;
      filter: drop-shadow(0 0 15px rgba(16, 185, 129, 0.4));
    }
    
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: var(--text);
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 15px;
      display: inline-block;
      margin-top: 24px;
      transition: all 0.2s ease;
    }
    
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  </style>
</head>
<body>
  <div class="card" id="main-card">
    <div class="checkout-container">
      <span class="badge">Splitmaro Pro</span>
      <div><span class="diamond">💎</span></div>
      <h1>Upgrade to Pro</h1>
      <p class="desc">Activate premium features including unlimited groups, detailed CSV exports, and recurring expenses.</p>
      
      <div class="price-box">
        <div class="price-label">One-Time Payment</div>
        <div class="price-val"><%= currencySymbol %><%= amount %></div>
      </div>
      
      <button class="btn" id="pay-btn" onclick="startPayment()">
        <span class="btn-text">Upgrade Now</span>
        <div class="spinner"></div>
      </button>
      
      <div class="status-msg" id="status-text"></div>
      
      <div class="footer-note">
        Secured by Razorpay. Safe & encrypted transactions.
      </div>
    </div>
    
    <div class="success-container">
      <div class="success-icon">✓</div>
      <h1>Upgrade Successful!</h1>
      <p class="desc" style="margin-bottom: 20px;">Thank you for upgrading to Splitmaro Pro. Enjoy your lifetime premium benefits!</p>
      <p class="desc" style="font-size: 13px;">You will be redirected back to the app automatically in a few seconds.</p>
      
      <a class="btn-secondary" href="splitmaro://pro-success">Go Back to App</a>
    </div>
  </div>

  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    const token = "<%= token %>";
    const keyId = "<%= keyId %>";
    const userName = "<%= name %>";
    const userEmail = "<%= email %>";
    const apiBase = "<%= apiBase %>";
    
    const payBtn = document.getElementById('pay-btn');
    const statusText = document.getElementById('status-text');
    const mainCard = document.getElementById('main-card');
    
    function setStatus(msg, type = 'info') {
      statusText.innerText = msg;
      statusText.className = 'status-msg ' + type;
    }
    
    async function startPayment() {
      payBtn.disabled = true;
      payBtn.classList.add('loading');
      setStatus('Initializing transaction...', 'info');
      
      try {
        const orderRes = await fetch(apiBase + '/api/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({
            amount: <%= amountPaise %>,
            currency: '<%= currency %>',
            receipt: 'receipt_upgrade_' + Date.now()
          })
        });
        
        if (!orderRes.ok) {
          const errData = await orderRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to create payment order');
        }
        
        const order = await orderRes.json();
        
        if (order.order_id.startsWith('order_mock_')) {
          setStatus('Simulating sandbox payment...', 'info');
          await verifyPayment({
            razorpay_payment_id: 'pay_mock_' + Math.random().toString(36).substring(2, 10),
            razorpay_order_id: order.order_id,
            razorpay_signature: 'sandbox-sig'
          });
          return;
        }
        
        const options = {
          key: keyId,
          amount: order.amount,
          currency: order.currency,
          name: "Splitmaro Pro",
          description: "Upgrade to Splitmaro Pro 💎",
          order_id: order.order_id,
          handler: async function (response) {
            setStatus('Verifying payment signature...', 'info');
            await verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });
          },
          prefill: {
            name: userName,
            email: userEmail
          },
          theme: {
            color: "#8b5cf6"
          },
          modal: {
            ondismiss: function () {
              payBtn.disabled = false;
              payBtn.classList.remove('loading');
              setStatus('Payment cancelled by user.', 'error');
            }
          }
        };
        
        const rzp = new Razorpay(options);
        rzp.on('payment.failed', function (resp) {
          setStatus('Payment failed: ' + (resp.error.description || 'Unknown error'), 'error');
          payBtn.disabled = false;
          payBtn.classList.remove('loading');
        });
        
        rzp.open();
        
      } catch (err) {
        console.error(err);
        setStatus(err.message || 'An error occurred during payment setup.', 'error');
        payBtn.disabled = false;
        payBtn.classList.remove('loading');
      }
    }
    
    async function verifyPayment(paymentDetails) {
      try {
        const verifyRes = await fetch(apiBase + '/api/verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify(paymentDetails)
        });
        
        if (!verifyRes.ok) {
          const errData = await verifyRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Payment verification failed');
        }
        
        const result = await verifyRes.json();
        
        if (result.success) {
          setStatus('Payment verified successfully!', 'success');
          mainCard.classList.add('state-success');
          setTimeout(() => {
            window.location.href = 'splitmaro://pro-success';
          }, 3000);
        } else {
          throw new Error('Verification did not return success status');
        }
      } catch (err) {
        console.error(err);
        setStatus(err.message || 'Error verifying payment. Please contact support.', 'error');
        payBtn.disabled = false;
        payBtn.classList.remove('loading');
      }
    }
  </script>
</body>
</html>`;

app.get('/api/payment/checkout', async (req, res) => {
  try {
    const token = req.query.token as string;
    if (!token) {
      return res.status(400).send('Missing authorization token in query string');
    }

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).send('Invalid or expired authorization token');
    }

    const userId = payload.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).send('User not found');
    }

    const escapedToken = JSON.stringify(token).slice(1, -1);
    const escapedKeyId = JSON.stringify(process.env.RAZORPAY_KEY_ID || '').slice(1, -1);
    const escapedName = JSON.stringify(user.name || '').slice(1, -1);
    const escapedEmail = JSON.stringify(user.email || 'customer@splitmaro.com').slice(1, -1);

    // Derive API base URL from the incoming request so checkout page fetches hit the right server
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:3000';
    const apiBaseUrl = `${protocol}://${host}`;
    const escapedApiBase = JSON.stringify(apiBaseUrl).slice(1, -1);

    const currencySymbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
    const currencySymbol = currencySymbols[PRO_UPGRADE_CURRENCY] || PRO_UPGRADE_CURRENCY;

    const html = checkoutHtmlTemplate
      .replace('<%= token %>', escapedToken)
      .replace('<%= keyId %>', escapedKeyId)
      .replace('<%= name %>', escapedName)
      .replace('<%= email %>', escapedEmail)
      .replace('<%= apiBase %>', escapedApiBase)
      .replace('<%= amount %>', PRO_UPGRADE_AMOUNT.toFixed(2))
      .replace('<%= amountPaise %>', (PRO_UPGRADE_AMOUNT * 100).toString())
      .replace('<%= currency %>', PRO_UPGRADE_CURRENCY)
      .replace('<%= currencySymbol %>', currencySymbol);

    res.send(html);
  } catch (error) {
    console.error('Checkout Page Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

// --- GROUP INVITATIONS & VIRAL GROWTH ENDPOINTS ---

app.post('/api/groups/:id/invite', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params as { id: string };

    const isMember = await isGroupMember(req.user.userId, id);
    if (!isMember) return res.status(403).json({ error: 'Forbidden: You are not a member of this group' });

    const token = jwt.sign({ groupId: id, referrerId: req.user.userId }, JWT_SECRET);
    res.json({ token, inviteUrl: `/join/${token}` });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/groups/join', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing token parameter' });

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired invitation link' });
    }

    const { groupId } = payload;
    const now = Date.now();

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return res.status(404).json({ error: 'Group not found' });

    await prisma.groupMember.upsert({
      where: { group_id_user_id: { group_id: groupId, user_id: req.user.userId } },
      update: {},
      create: { group_id: groupId, user_id: req.user.userId }
    });

    await prisma.group.update({
      where: { id: groupId },
      data: { updated_at: BigInt(now) }
    });

    res.json({ success: true, groupId });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/api/groups/invite-info', authenticateToken as any, async (req: AuthRequest, res) => {
  try {
    const token = req.query.token as string;
    if (!token) return res.status(400).json({ error: 'Missing token parameter' });

    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired invitation link' });
    }

    const { groupId } = payload;
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { members: true }
    });

    if (!group) return res.status(404).json({ error: 'Group not found' });

    res.json({
      id: group.id,
      name: group.name,
      category: group.category || 'other',
      member_count: group.members.length
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

app.get('/join/:token', async (req, res) => {
  try {
    const { token } = req.params;
    let payload: any;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Invite - Splitmaro</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            body { background: #070a13; color: #fff; font-family: 'Outfit', sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
            .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 40px; border-radius: 24px; max-width: 400px; width: 90%; backdrop-filter: blur(10px); }
            h1 { color: #ef4444; font-size: 24px; margin-bottom: 12px; font-weight: 800; }
            p { color: #94a3b8; font-size: 15px; line-height: 1.5; margin-bottom: 24px; }
            .btn { background: #6366f1; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; display: inline-block; transition: background 0.2s; box-shadow: 0 4px 15px rgba(99,102,241,0.3); }
            .btn:hover { background: #4f46e5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Invalid Invitation</h1>
            <p>This invite link is invalid or has expired. Please ask your friend for a new invitation link.</p>
            <a href="https://splitmaro.com" class="btn">Go to Home</a>
          </div>
        </body>
        </html>
      `);
    }

    const { groupId, referrerId } = payload;
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });
    if (!group) return res.status(404).send('Group not found');

    const balances = await getGroupBalances(groupId);
    const expenses = await prisma.expense.findMany({
      where: { group_id: groupId },
      orderBy: { created_at: 'desc' },
      take: 5
    });

    const referrer = referrerId ? await prisma.user.findUnique({ where: { id: referrerId } }) : null;

    // Generate UPI settle options
    const usersWithUpi = await prisma.user.findMany({
      where: {
        member_of: { some: { group_id: groupId } },
        upi_id: { not: null }
      },
      select: { id: true, name: true, upi_id: true, avatar_color: true }
    });

    const membersHtml = balances.map(b => {
      const isOwed = b.amount > 0.01;
      const isOwe = b.amount < -0.01;
      const amtStr = Math.abs(b.amount).toFixed(2);
      const color = isOwed ? '#10b981' : (isOwe ? '#ef4444' : '#9ca3af');
      const actionHtml = isOwe ? `
        <button class="settle-btn" onclick="openSettleModal('${b.userId}', '${b.userName}')">Settle up</button>
      ` : '';

      return `
        <div class="member-row">
          <div class="avatar" style="background: ${b.avatarColor || '#6366f1'}">${b.userName.charAt(0).toUpperCase()}</div>
          <div class="member-info">
            <span class="member-name">${b.userName}</span>
            <span class="member-status" style="color: ${color}">
              ${isOwed ? `is owed ₹${amtStr}` : (isOwe ? `owes ₹${amtStr}` : 'settled up')}
            </span>
          </div>
          ${actionHtml}
        </div>
      `;
    }).join('');

    const expensesHtml = expenses.length > 0 ? expenses.map(e => {
      return `
        <div class="expense-row">
          <div class="expense-details">
            <span class="expense-desc">${e.description}</span>
            <span class="expense-meta">${new Date(Number(e.created_at)).toLocaleDateString()}</span>
          </div>
          <span class="expense-amt">₹${e.amount.toFixed(2)}</span>
        </div>
      `;
    }).join('') : '<div class="no-expenses">No expenses added yet.</div>';

    const upiUsersJson = JSON.stringify(usersWithUpi);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Splitmaro Invitation - ${group.name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; font-family: 'Outfit', sans-serif; }
          body { background: #070a13; color: #fff; margin: 0; padding: 24px 16px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
          .container { max-width: 480px; width: 100%; display: flex; flex-direction: column; gap: 24px; margin-bottom: 40px; }
          
          /* Header Card */
          .header-card {
            background: linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.15) 100%);
            border: 1px solid rgba(255,255,255,0.06);
            border-radius: 24px;
            padding: 32px 24px;
            text-align: center;
            backdrop-filter: blur(20px);
            position: relative;
            overflow: hidden;
          }
          .header-card::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%);
            z-index: -1;
          }
          .icon-box {
            width: 64px;
            height: 64px;
            background: rgba(99,102,241,0.2);
            border-radius: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 16px;
            color: #818cf8;
            font-size: 32px;
          }
          h1 { font-size: 24px; font-weight: 800; margin: 0 0 8px 0; letter-spacing: -0.5px; }
          .referrer-text { font-size: 14px; color: #94a3b8; margin: 0 0 24px 0; }
          .btn-join {
            background: #6366f1;
            color: #fff;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 16px;
            font-weight: 700;
            display: block;
            box-shadow: 0 4px 20px rgba(99,102,241,0.4);
            transition: all 0.2s;
          }
          .btn-join:hover { background: #4f46e5; transform: translateY(-1px); }
          .btn-join:active { transform: translateY(1px); }
          
          /* Panel Card */
          .card {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 20px;
            padding: 20px;
            backdrop-filter: blur(10px);
          }
          h2 { font-size: 13px; font-weight: 700; margin: 0 0 16px 0; color: #64748b; letter-spacing: 1px; text-transform: uppercase; }
          
          /* Member Rows */
          .member-row {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 0;
          }
          .member-row:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,0.04); }
          .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 16px;
            color: #fff;
          }
          .member-info { display: flex; flex-direction: column; flex: 1; }
          .member-name { font-size: 15px; font-weight: 600; }
          .member-status { font-size: 13px; margin-top: 2px; }
          .settle-btn {
            background: rgba(16,185,129,0.12);
            color: #34d399;
            border: 1px solid rgba(16,185,129,0.2);
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .settle-btn:hover { background: #10b981; color: #fff; }
          
          /* Expense Rows */
          .expense-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 0;
          }
          .expense-row:not(:last-child) { border-bottom: 1px solid rgba(255,255,255,0.04); }
          .expense-details { display: flex; flex-direction: column; }
          .expense-desc { font-size: 15px; font-weight: 600; }
          .expense-meta { font-size: 12px; color: #64748b; margin-top: 2px; }
          .expense-amt { font-size: 15px; font-weight: 700; color: #f8fafc; }
          .no-expenses { text-align: center; color: #64748b; padding: 20px 0; font-size: 14px; }
          
          /* Footer */
          .footer { text-align: center; font-size: 13px; color: #475569; }
          .footer a { color: #6366f1; text-decoration: none; font-weight: 600; }
          
          /* Modal */
          .modal-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.85);
            display: none;
            align-items: center;
            justify-content: center;
            padding: 20px;
            z-index: 100;
            backdrop-filter: blur(8px);
          }
          .modal {
            background: #0d111d;
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 24px;
            padding: 28px;
            width: 100%;
            max-width: 400px;
            text-align: center;
            position: relative;
          }
          .close-modal {
            position: absolute;
            top: 16px; right: 16px;
            background: none; border: none;
            color: #64748b; font-size: 24px;
            cursor: pointer;
          }
          .modal-title { font-size: 18px; font-weight: 700; margin-bottom: 8px; }
          .modal-sub { font-size: 14px; color: #94a3b8; margin-bottom: 24px; }
          .pay-option {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 16px;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
            text-align: left;
            cursor: pointer;
            transition: all 0.2s;
          }
          .pay-option:hover { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.3); }
          .pay-option-info { display: flex; flex-direction: column; flex: 1; }
          .pay-option-name { font-weight: 600; font-size: 15px; }
          .pay-option-vpa { font-size: 12px; color: #64748b; margin-top: 2px; }
          .btn-upi-intent {
            background: #10b981;
            color: #fff;
            text-decoration: none;
            padding: 14px;
            border-radius: 14px;
            font-weight: 700;
            display: block;
            margin-top: 20px;
            transition: background 0.2s;
          }
          .btn-upi-intent:hover { background: #059669; }
          .no-upi-note { color: #f59e0b; font-size: 13px; margin-top: 12px; line-height: 1.4; padding: 10px; background: rgba(245,158,11,0.08); border-radius: 10px; border: 1px dashed rgba(245,158,11,0.3); }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header-card">
            <div class="icon-box">👥</div>
            <h1>${group.name}</h1>
            <p class="referrer-text">Invited by ${referrer ? referrer.name : 'a group member'}</p>
            <a href="splitmaro://join?token=${token}" class="btn-join">Open in Splitmaro</a>
          </div>

          <div class="card">
            <h2>Group Balances</h2>
            ${membersHtml}
          </div>

          <div class="card">
            <h2>Recent Expenses</h2>
            ${expensesHtml}
          </div>

          <div class="footer">
            Track expenses together offline-first. <br>
            Powered by <a href="https://splitmaro.com">Splitmaro</a>.
          </div>
        </div>

        <!-- Settle Modal -->
        <div class="modal-overlay" id="settleModalOverlay">
          <div class="modal">
            <button class="close-modal" onclick="closeSettleModal()">&times;</button>
            <div class="modal-title" id="modalTitle">Settle with Member</div>
            <div class="modal-sub">Launch your mobile payment app to settle instantly via UPI</div>
            
            <div id="upiOptionsContainer"></div>
            
            <div class="no-upi-note" id="noUpiNote" style="display: none;">
              This friend has not configured their UPI ID in Splitmaro yet. Ask them to add their UPI ID in settings to settle instantly!
            </div>
          </div>
        </div>

        <script>
          const upiUsers = ${upiUsersJson};
          let selectedUser = null;

          function openSettleModal(userId, userName) {
            selectedUser = upiUsers.find(u => u.id === userId) || null;
            document.getElementById('modalTitle').innerText = 'Settle with ' + userName;
            const upiContainer = document.getElementById('upiOptionsContainer');
            const noUpiNote = document.getElementById('noUpiNote');
            
            upiContainer.innerHTML = '';
            
            if (selectedUser && selectedUser.upi_id) {
              noUpiNote.style.display = 'none';
              
              // Create dynamic UPI intent
              const upiIntent = 'upi://pay?pa=' + selectedUser.upi_id + '&pn=' + encodeURIComponent(selectedUser.name) + '&cu=INR&tn=Splitmaro%20Settlement';
              
              upiContainer.innerHTML = \`
                <div class="pay-option" onclick="triggerPayment('\${upiIntent}')">
                  <div class="avatar" style="background: \${selectedUser.avatar_color || '#6366f1'}">\${selectedUser.name.charAt(0).toUpperCase()}</div>
                  <div class="pay-option-info">
                    <span class="pay-option-name">Settle via UPI App</span>
                    <span class="pay-option-vpa">\${selectedUser.upi_id}</span>
                  </div>
                </div>
                <a href="\${upiIntent}" class="btn-upi-intent">Pay with UPI App</a>
              \`;
            } else {
              noUpiNote.style.display = 'block';
            }
            
            document.getElementById('settleModalOverlay').style.display = 'flex';
          }

          function closeSettleModal() {
            document.getElementById('settleModalOverlay').style.display = 'none';
          }

          function triggerPayment(intentUrl) {
            window.location.href = intentUrl;
          }
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Invite Redirect Page Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Splitmaro API listening on port ${PORT}`);
});


