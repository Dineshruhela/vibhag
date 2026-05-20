/**
 * Vibhag Database Layer
 * SQLite database initialization and operations
 */
import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { AvatarColors } from '../constants/Colors';
import { api, apiRequest } from './api';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('vibhag.db');
    await initDatabase(db);
  }
  return db;
}

async function initDatabase(database: SQLite.SQLiteDatabase) {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      avatar_color TEXT NOT NULL,
      upi_id TEXT,
      is_pro INTEGER DEFAULT 0,
      is_current_user INTEGER DEFAULT 0,
      budget_amount REAL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS groups_ (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'other',
      cover_image TEXT,
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL REFERENCES groups_(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups_(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'INR',
      category TEXT DEFAULT 'general',
      split_type TEXT DEFAULT 'equal',
      receipt_uri TEXT,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recurring_type TEXT, -- 'none', 'weekly', 'monthly', 'yearly'
      recurring_last_generated INTEGER,
      is_recurring_parent INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expense_payers (
      expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      PRIMARY KEY (expense_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS expense_shares (
      expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      share_amount REAL NOT NULL,
      PRIMARY KEY (expense_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES groups_(id) ON DELETE CASCADE,
      payer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount REAL NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expense_comments (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Migrations table — tracks which migrations have been applied
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    (await database.getAllAsync<{ id: string }>('SELECT id FROM schema_migrations')).map(r => r.id)
  );

  const migrations: Array<{ id: string; sql: string }> = [
    { id: '001_users_upi_id', sql: 'ALTER TABLE users ADD COLUMN upi_id TEXT;' },
    { id: '002_users_is_pro', sql: 'ALTER TABLE users ADD COLUMN is_pro INTEGER DEFAULT 0;' },
    { id: '003_expenses_recurring_type', sql: 'ALTER TABLE expenses ADD COLUMN recurring_type TEXT;' },
    { id: '004_expenses_recurring_last_generated', sql: 'ALTER TABLE expenses ADD COLUMN recurring_last_generated INTEGER;' },
    { id: '005_expenses_is_recurring_parent', sql: 'ALTER TABLE expenses ADD COLUMN is_recurring_parent INTEGER DEFAULT 0;' },
    { id: '006_users_budget_amount', sql: 'ALTER TABLE users ADD COLUMN budget_amount REAL;' },
    { id: '007_expenses_notes_receipt', sql: 'ALTER TABLE expenses ADD COLUMN notes TEXT;' },
    { id: '008_expenses_notes_receipt_url', sql: 'ALTER TABLE expenses ADD COLUMN receipt_url TEXT;' },
    { id: '009_users_updated_at', sql: 'ALTER TABLE users ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;' },
    { id: '010_groups_created_by', sql: 'ALTER TABLE groups_ ADD COLUMN created_by TEXT;' },
  ];

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    try {
      await database.execAsync(migration.sql);
    } catch {
      // Column may already exist if DB was created with latest schema — still mark applied
    }
    await database.runAsync(
      'INSERT OR IGNORE INTO schema_migrations (id, applied_at) VALUES (?, ?)',
      [migration.id, Date.now()]
    );
  }

  // (Removed) Do not auto-create a default user. User will be created after onboarding or login.
}

// ======== USER OPERATIONS ========

export type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_color: string;
  upi_id: string | null;
  is_pro: number;
  budget_amount: number | null;
  is_current_user: number;
  created_at: number;
};

export async function getCurrentUser(): Promise<User> {
  const db = await getDatabase();
  const user = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE is_current_user = 1'
  );
  return user!;
}

/**
 * Called after a successful login/signup to replace the ephemeral local user
 * (created at DB init) with the real server-authenticated user.
 */
export async function setupLocalUserFromAuth(serverUser: {
  id: string;
  name: string;
  email?: string | null;
  avatar_color: string;
  created_at?: number;
  updated_at?: number;
}): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  // Strip the is_current_user flag from any previous local user
  await db.runAsync('UPDATE users SET is_current_user = 0 WHERE is_current_user = 1');
  // Upsert the server user and mark as current
  await db.runAsync(`
    INSERT INTO users (id, name, email, avatar_color, is_current_user, created_at, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      email = excluded.email,
      avatar_color = excluded.avatar_color,
      is_current_user = 1,
      updated_at = excluded.updated_at
  `, [
    serverUser.id,
    serverUser.name,
    serverUser.email ?? null,
    serverUser.avatar_color,
    serverUser.created_at ?? now,
    serverUser.updated_at ?? now,
  ]);
}

/**
 * Wipes all local SQLite data. Called on sign-out so the next user starts fresh.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export async function clearLocalDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM expense_comments;
    DELETE FROM expense_shares;
    DELETE FROM expense_payers;
    DELETE FROM settlements;
    DELETE FROM expenses;
    DELETE FROM group_members;
    DELETE FROM groups_;
    DELETE FROM users;
    PRAGMA foreign_keys = ON;
  `);
}

export async function clearAllLocalData(): Promise<void> {
  await clearLocalDatabase();
  await AsyncStorage.clear();
}

export async function getUser(id: string): Promise<User | null> {
  const db = await getDatabase();
  const user = await db.getFirstAsync<User>(
    'SELECT * FROM users WHERE id = ?',
    [id]
  );
  return user;
}

export async function getAllFriends(): Promise<User[]> {
  const db = await getDatabase();
  return db.getAllAsync<User>(
    'SELECT * FROM users WHERE is_current_user = 0 ORDER BY name ASC'
  );
}

export async function addFriend(name: string, email?: string, phone?: string, avatarColor?: string): Promise<User> {
  const db = await getDatabase();
  const trimmedName = name.trim();
  const trimmedEmail = email?.trim().toLowerCase() || null;
  const trimmedPhone = phone?.trim() || null;
  const finalColor = avatarColor || AvatarColors[Math.floor(Math.random() * AvatarColors.length)];
  const now = Date.now();

  let serverUser: any = null;

  // If there is an email, try to verify/create it on the server first
  if (trimmedEmail && trimmedEmail.includes('@')) {
    try {
      serverUser = await api.searchOrCreateUser({
        email: trimmedEmail,
        name: trimmedName,
        avatar_color: finalColor
      });
    } catch (err) {
      console.warn('[addFriend] Server searchOrCreateUser failed (likely offline). Falling back to local creation:', err);
    }
  }

  // If we got a response from the server, use its ID and verified attributes
  if (serverUser && serverUser.id) {
    const existing = await db.getFirstAsync<User>(
      'SELECT * FROM users WHERE id = ?',
      [serverUser.id]
    );

    if (existing) {
      return existing;
    }

    await db.runAsync(
      'INSERT INTO users (id, name, email, phone, avatar_color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        serverUser.id,
        serverUser.name,
        trimmedEmail || serverUser.email || null,
        trimmedPhone || serverUser.phone || null,
        serverUser.avatar_color || finalColor,
        now,
        now
      ]
    );

    // Trigger background sync
    require('./sync').pushToCloud().catch(console.error);

    return {
      id: serverUser.id,
      name: serverUser.name,
      email: trimmedEmail || serverUser.email || null,
      phone: trimmedPhone || serverUser.phone || null,
      avatar_color: serverUser.avatar_color || finalColor,
      upi_id: serverUser.upi_id || null,
      is_pro: serverUser.is_pro || 0,
      is_current_user: 0,
      budget_amount: serverUser.budget_amount || null,
      created_at: now
    };
  }

  // Fallback / Offline path: Create the user locally with a random UUID
  const localId = Crypto.randomUUID();

  // If email was provided, check if a user with that email already exists locally
  if (trimmedEmail) {
    const existingWithEmail = await db.getFirstAsync<User>(
      'SELECT * FROM users WHERE LOWER(TRIM(email)) = ?',
      [trimmedEmail]
    );
    if (existingWithEmail) {
      return existingWithEmail;
    }
  }

  await db.runAsync(
    'INSERT INTO users (id, name, email, phone, avatar_color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      localId,
      trimmedName,
      trimmedEmail,
      trimmedPhone,
      finalColor,
      now,
      now
    ]
  );

  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);

  return {
    id: localId,
    name: trimmedName,
    email: trimmedEmail,
    phone: trimmedPhone,
    avatar_color: finalColor,
    upi_id: null,
    is_pro: 0,
    is_current_user: 0,
    budget_amount: null,
    created_at: now
  };
}

export async function updateUser(id: string, updates: Partial<Pick<User, 'name' | 'email' | 'phone' | 'avatar_color' | 'upi_id' | 'is_pro' | 'budget_amount'>>): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const values: any[] = [];
  
  if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
  if (updates.email !== undefined) { sets.push('email = ?'); values.push(updates.email); }
  if (updates.phone !== undefined) { sets.push('phone = ?'); values.push(updates.phone); }
  if (updates.avatar_color !== undefined) { sets.push('avatar_color = ?'); values.push(updates.avatar_color); }
  if (updates.upi_id !== undefined) { sets.push('upi_id = ?'); values.push(updates.upi_id); }
  if (updates.is_pro !== undefined) { sets.push('is_pro = ?'); values.push(updates.is_pro); }
  if (updates.budget_amount !== undefined) { sets.push('budget_amount = ?'); values.push(updates.budget_amount); }
  
  if (sets.length === 0) return;
  values.push(id);
  
  await db.runAsync(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
  
  require('./sync').pushToCloud().catch(console.error);
}

export async function deleteFriend(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM users WHERE id = ? AND is_current_user = 0', [id]);
  
  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);
}

// ======== GROUP OPERATIONS ========

export type Group = {
  id: string;
  name: string;
  category: string;
  cover_image: string | null;
  created_by?: string | null;
  created_at: number;
  updated_at: number;
  member_count?: number;
};

export async function getGroupsCount(): Promise<number> {
  const db = await getDatabase();
  const res = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM groups_');
  return res?.count || 0;
}

export async function getAllGroups(): Promise<Group[]> {
  const db = await getDatabase();
  return db.getAllAsync<Group>(`
    SELECT g.*, COUNT(gm.user_id) as member_count
    FROM groups_ g
    LEFT JOIN group_members gm ON g.id = gm.group_id
    GROUP BY g.id
    ORDER BY g.updated_at DESC
  `);
}

/**
 * Returns the current user's net balance (positive = owed, negative = owes) for each group.
 * Single query for all groups — safe to call on the groups list screen.
 */
export async function getGroupBalancesForCurrentUser(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const currentUser = await getCurrentUser();

  const paid = await db.getAllAsync<{ group_id: string; total: number }>(`
    SELECT e.group_id, SUM(ep.amount) as total
    FROM expense_payers ep
    INNER JOIN expenses e ON ep.expense_id = e.id
    WHERE ep.user_id = ?
    GROUP BY e.group_id
  `, [currentUser.id]);

  const owed = await db.getAllAsync<{ group_id: string; total: number }>(`
    SELECT e.group_id, SUM(es.share_amount) as total
    FROM expense_shares es
    INNER JOIN expenses e ON es.expense_id = e.id
    WHERE es.user_id = ?
    GROUP BY e.group_id
  `, [currentUser.id]);

  const settled_paid = await db.getAllAsync<{ group_id: string; total: number }>(`
    SELECT group_id, SUM(amount) as total
    FROM settlements
    WHERE payer_id = ?
    GROUP BY group_id
  `, [currentUser.id]);

  const settled_recv = await db.getAllAsync<{ group_id: string; total: number }>(`
    SELECT group_id, SUM(amount) as total
    FROM settlements
    WHERE payee_id = ?
    GROUP BY group_id
  `, [currentUser.id]);

  const result: Record<string, number> = {};
  for (const r of paid)        result[r.group_id] = (result[r.group_id] || 0) + r.total;
  for (const r of owed)        result[r.group_id] = (result[r.group_id] || 0) - r.total;
  for (const r of settled_paid) result[r.group_id] = (result[r.group_id] || 0) + r.total;
  for (const r of settled_recv) result[r.group_id] = (result[r.group_id] || 0) - r.total;

  // Round to 2 decimal places
  for (const k of Object.keys(result)) {
    result[k] = Math.round(result[k] * 100) / 100;
  }

  return result;
}

export async function getGroup(id: string): Promise<Group | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Group>(`
    SELECT g.*, COUNT(gm.user_id) as member_count
    FROM groups_ g
    LEFT JOIN group_members gm ON g.id = gm.group_id
    WHERE g.id = ?
    GROUP BY g.id
  `, [id]);
}

export async function createGroup(name: string, category: string, memberIds: string[]): Promise<Group> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();
  const currentUser = await getCurrentUser();
  const allMemberIds = currentUser ? [currentUser.id, ...memberIds] : memberIds;
  
  await db.runAsync(
    'INSERT INTO groups_ (id, name, category, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, category, currentUser?.id || null, now, now]
  );
  
  for (const memberId of allMemberIds) {
    await db.runAsync(
      'INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)',
      [id, memberId]
    );
  }
  
  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);

  return { id, name, category, cover_image: null, created_by: currentUser?.id || null, created_at: now, updated_at: now, member_count: allMemberIds.length };
}

export async function updateGroup(id: string, updates: Partial<Pick<Group, 'name' | 'category'>>): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = ['updated_at = ?'];
  const values: any[] = [Date.now()];
  
  if (updates.name !== undefined) { sets.push('name = ?'); values.push(updates.name); }
  if (updates.category !== undefined) { sets.push('category = ?'); values.push(updates.category); }
  
  values.push(id);
  await db.runAsync(`UPDATE groups_ SET ${sets.join(', ')} WHERE id = ?`, values);
  
  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);
}

export async function deleteGroup(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM groups_ WHERE id = ?', [id]);
  
  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);
}



export async function getGroupMembers(groupId: string): Promise<User[]> {
  const db = await getDatabase();
  return db.getAllAsync<User>(`
    SELECT u.* FROM users u
    INNER JOIN group_members gm ON u.id = gm.user_id
    WHERE gm.group_id = ?
    ORDER BY u.is_current_user DESC, u.name ASC
  `, [groupId]);
}

export async function addGroupMember(groupId: string, userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)',
    [groupId, userId]
  );
  await db.runAsync('UPDATE groups_ SET updated_at = ? WHERE id = ?', [Date.now(), groupId]);
  
  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
    [groupId, userId]
  );
  
  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);
}

// ======== EXPENSE OPERATIONS ========

export type Expense = {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  currency: string;
  category: string;
  split_type: string;
  receipt_uri: string | null;
  created_by: string;
  recurring_type: string | null;
  recurring_last_generated: number | null;
  is_recurring_parent: number;
  created_at: number;
  updated_at: number;
  notes: string | null;
  // Joined fields
  creator_name?: string;
  group_name?: string;
};

export type ExpensePayer = {
  expense_id: string;
  user_id: string;
  amount: number;
  name?: string;
};

export type ExpenseShare = {
  expense_id: string;
  user_id: string;
  share_amount: number;
  name?: string;
};

export async function getGroupExpenses(groupId: string): Promise<Expense[]> {
  const db = await getDatabase();
  return db.getAllAsync<Expense>(`
    SELECT e.*, u.name as creator_name
    FROM expenses e
    LEFT JOIN users u ON e.created_by = u.id
    WHERE e.group_id = ?
    ORDER BY e.created_at DESC
  `, [groupId]);
}

export async function getAllExpenses(): Promise<Expense[]> {
  const db = await getDatabase();
  return db.getAllAsync<Expense>(`
    SELECT e.*, u.name as creator_name, g.name as group_name
    FROM expenses e
    LEFT JOIN users u ON e.created_by = u.id
    LEFT JOIN groups_ g ON e.group_id = g.id
    ORDER BY e.created_at DESC
    LIMIT 100
  `);
}

export async function getExpense(id: string): Promise<Expense | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Expense>(`
    SELECT e.*, u.name as creator_name, g.name as group_name
    FROM expenses e
    LEFT JOIN users u ON e.created_by = u.id
    LEFT JOIN groups_ g ON e.group_id = g.id
    WHERE e.id = ?
  `, [id]);
}

export async function getExpensePayers(expenseId: string): Promise<ExpensePayer[]> {
  const db = await getDatabase();
  return db.getAllAsync<ExpensePayer>(`
    SELECT ep.*, u.name FROM expense_payers ep
    LEFT JOIN users u ON ep.user_id = u.id
    WHERE ep.expense_id = ?
  `, [expenseId]);
}

export async function getExpenseShares(expenseId: string): Promise<ExpenseShare[]> {
  const db = await getDatabase();
  return db.getAllAsync<ExpenseShare>(`
    SELECT es.*, u.name FROM expense_shares es
    LEFT JOIN users u ON es.user_id = u.id
    WHERE es.expense_id = ?
  `, [expenseId]);
}

/**
 * Batch fetch payers and shares for multiple expenses in two queries.
 * Returns maps keyed by expense_id for O(1) lookup.
 */
export async function getExpenseDetailsForGroup(groupId: string): Promise<{
  payersByExpense: Record<string, ExpensePayer[]>;
  sharesByExpense: Record<string, ExpenseShare[]>;
}> {
  const db = await getDatabase();

  const payers = await db.getAllAsync<ExpensePayer & { name: string }>(`
    SELECT ep.*, u.name
    FROM expense_payers ep
    INNER JOIN expenses e ON ep.expense_id = e.id
    LEFT JOIN users u ON ep.user_id = u.id
    WHERE e.group_id = ?
  `, [groupId]);

  const shares = await db.getAllAsync<ExpenseShare & { name: string }>(`
    SELECT es.*, u.name
    FROM expense_shares es
    INNER JOIN expenses e ON es.expense_id = e.id
    LEFT JOIN users u ON es.user_id = u.id
    WHERE e.group_id = ?
  `, [groupId]);

  const payersByExpense: Record<string, ExpensePayer[]> = {};
  for (const p of payers) {
    if (!payersByExpense[p.expense_id]) payersByExpense[p.expense_id] = [];
    payersByExpense[p.expense_id].push(p);
  }

  const sharesByExpense: Record<string, ExpenseShare[]> = {};
  for (const s of shares) {
    if (!sharesByExpense[s.expense_id]) sharesByExpense[s.expense_id] = [];
    sharesByExpense[s.expense_id].push(s);
  }

  return { payersByExpense, sharesByExpense };
}

export type CreateExpenseInput = {
  groupId: string;
  description: string;
  amount: number;
  category?: string;
  splitType?: string;
  payers: { userId: string; amount: number }[];
  shares: { userId: string; shareAmount: number }[];
  receiptUri?: string | null;
  recurringType?: 'none' | 'weekly' | 'monthly' | 'yearly';
  isRecurringParent?: boolean;
  notes?: string;
  currency?: string;
};

export async function createExpense(input: CreateExpenseInput): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();
  const currentUser = await getCurrentUser();
  
  await db.runAsync(
    `INSERT INTO expenses (id, group_id, description, amount, currency, category, split_type, receipt_uri, created_by, recurring_type, is_recurring_parent, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.groupId, input.description, input.amount, input.currency || 'INR', input.category || 'general', input.splitType || 'equal', input.receiptUri || null, currentUser.id, input.recurringType || 'none', input.isRecurringParent ? 1 : 0, input.notes || null, now, now]
  );
  
  for (const payer of input.payers) {
    await db.runAsync(
      'INSERT INTO expense_payers (expense_id, user_id, amount) VALUES (?, ?, ?)',
      [id, payer.userId, payer.amount]
    );
  }
  
  for (const share of input.shares) {
    await db.runAsync(
      'INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES (?, ?, ?)',
      [id, share.userId, share.shareAmount]
    );
  }
  
  // Update group timestamp
  await db.runAsync('UPDATE groups_ SET updated_at = ? WHERE id = ?', [now, input.groupId]);
  
  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);

  return id;
}

export async function updateExpense(id: string, input: Partial<CreateExpenseInput>): Promise<void> {
  const db = await getDatabase();
  const now = Date.now();
  
  if (input.description !== undefined || input.amount !== undefined || input.category !== undefined || input.notes !== undefined || input.receiptUri !== undefined || input.recurringType !== undefined || input.isRecurringParent !== undefined || input.currency !== undefined) {
    const sets: string[] = ['updated_at = ?'];
    const values: any[] = [now];
    
    if (input.description !== undefined) { sets.push('description = ?'); values.push(input.description); }
    if (input.amount !== undefined) { sets.push('amount = ?'); values.push(input.amount); }
    if (input.currency !== undefined) { sets.push('currency = ?'); values.push(input.currency); }
    if (input.category !== undefined) { sets.push('category = ?'); values.push(input.category); }
    if (input.notes !== undefined) { sets.push('notes = ?'); values.push(input.notes); }
    if (input.receiptUri !== undefined) { sets.push('receipt_uri = ?'); values.push(input.receiptUri); }
    if (input.recurringType !== undefined) { sets.push('recurring_type = ?'); values.push(input.recurringType); }
    if (input.isRecurringParent !== undefined) { sets.push('is_recurring_parent = ?'); values.push(input.isRecurringParent ? 1 : 0); }
    
    values.push(id);
    await db.runAsync(`UPDATE expenses SET ${sets.join(', ')} WHERE id = ?`, values);
  }
  
  if (input.payers) {
    await db.runAsync('DELETE FROM expense_payers WHERE expense_id = ?', [id]);
    for (const payer of input.payers) {
      await db.runAsync(
        'INSERT INTO expense_payers (expense_id, user_id, amount) VALUES (?, ?, ?)',
        [id, payer.userId, payer.amount]
      );
    }
  }
  
  if (input.shares) {
    await db.runAsync('DELETE FROM expense_shares WHERE expense_id = ?', [id]);
    for (const share of input.shares) {
      await db.runAsync(
        'INSERT INTO expense_shares (expense_id, user_id, share_amount) VALUES (?, ?, ?)',
        [id, share.userId, share.shareAmount]
      );
    }
  }
  
  if (input.groupId) {
    await db.runAsync('UPDATE groups_ SET updated_at = ? WHERE id = ?', [now, input.groupId]);
  }
  
  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);
}

export async function deleteExpense(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
  
  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);
}

// ======== SETTLEMENT OPERATIONS ========

export type Settlement = {
  id: string;
  group_id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  note: string | null;
  created_at: number;
  payer_name?: string;
  payee_name?: string;
  group_name?: string;
};

export async function getGroupSettlements(groupId: string): Promise<Settlement[]> {
  const db = await getDatabase();
  return db.getAllAsync<Settlement>(`
    SELECT s.*, 
      p.name as payer_name, 
      r.name as payee_name,
      g.name as group_name
    FROM settlements s
    LEFT JOIN users p ON s.payer_id = p.id
    LEFT JOIN users r ON s.payee_id = r.id
    LEFT JOIN groups_ g ON s.group_id = g.id
    WHERE s.group_id = ?
    ORDER BY s.created_at DESC
  `, [groupId]);
}

export async function createSettlement(
  groupId: string,
  payerId: string,
  payeeId: string,
  amount: number,
  note?: string
): Promise<string> {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const now = Date.now();
  
  await db.runAsync(
    'INSERT INTO settlements (id, group_id, payer_id, payee_id, amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, groupId, payerId, payeeId, amount, note || null, now]
  );
  
  await db.runAsync('UPDATE groups_ SET updated_at = ? WHERE id = ?', [now, groupId]);
  
  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);
  
  return id;
}

// ======== BALANCE CALCULATIONS ========

export type Balance = {
  userId: string;
  userName: string;
  userEmail?: string;
  avatarColor: string;
  amount: number; // positive = owed to them, negative = they owe
};

export type DebtEdge = {
  from: User;
  to: User;
  amount: number;
};

export async function calculateGroupBalances(groupId: string): Promise<Balance[]> {
  const db = await getDatabase();
  const members = await getGroupMembers(groupId);
  const balanceMap: Record<string, number> = {};
  
  // Initialize
  for (const member of members) {
    balanceMap[member.id] = 0;
  }
  
  // Add what each person paid
  const payers = await db.getAllAsync<{ user_id: string; total: number }>(`
    SELECT ep.user_id, SUM(ep.amount) as total
    FROM expense_payers ep
    INNER JOIN expenses e ON ep.expense_id = e.id
    WHERE e.group_id = ?
    GROUP BY ep.user_id
  `, [groupId]);
  
  for (const p of payers) {
    if (balanceMap[p.user_id] !== undefined) {
      balanceMap[p.user_id] += p.total;
    }
  }
  
  // Subtract what each person owes
  const shares = await db.getAllAsync<{ user_id: string; total: number }>(`
    SELECT es.user_id, SUM(es.share_amount) as total
    FROM expense_shares es
    INNER JOIN expenses e ON es.expense_id = e.id
    WHERE e.group_id = ?
    GROUP BY es.user_id
  `, [groupId]);
  
  for (const s of shares) {
    if (balanceMap[s.user_id] !== undefined) {
      balanceMap[s.user_id] -= s.total;
    }
  }
  
  // Add settlements (payer reduces their debt)
  const settlements = await db.getAllAsync<{ payer_id: string; payee_id: string; total: number }>(`
    SELECT payer_id, payee_id, SUM(amount) as total
    FROM settlements
    WHERE group_id = ?
    GROUP BY payer_id, payee_id
  `, [groupId]);
  
  for (const s of settlements) {
    if (balanceMap[s.payer_id] !== undefined) {
      balanceMap[s.payer_id] += s.total;
    }
    if (balanceMap[s.payee_id] !== undefined) {
      balanceMap[s.payee_id] -= s.total;
    }
  }
  
  return members.map(m => ({
    userId: m.id,
    userName: m.name,
    userEmail: m.email || undefined,
    avatarColor: m.avatar_color,
    amount: Math.round(balanceMap[m.id] * 100) / 100,
  }));
}

/**
 * Simplify debts - minimize number of transactions
 * Uses greedy algorithm: match largest creditor with largest debtor
 */
export async function getSimplifiedDebts(groupId: string): Promise<DebtEdge[]> {
  const balances = await calculateGroupBalances(groupId);
  const members = await getGroupMembers(groupId);
  const memberMap: Record<string, User> = {};
  members.forEach(m => { memberMap[m.id] = m; });
  
  const creditors: { id: string; amount: number }[] = [];
  const debtors: { id: string; amount: number }[] = [];
  
  for (const b of balances) {
    if (b.amount > 0.01) {
      creditors.push({ id: b.userId, amount: b.amount });
    } else if (b.amount < -0.01) {
      debtors.push({ id: b.userId, amount: Math.abs(b.amount) });
    }
  }
  
  // Sort descending
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  
  const edges: DebtEdge[] = [];
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

// ======== OVERALL BALANCE ========

export async function getOverallBalance(): Promise<{ totalOwed: number; totalOwe: number; balancesByUser: Balance[] }> {
  const db = await getDatabase();
  const currentUser = await getCurrentUser();
  const groups = await getAllGroups();
  
  const userBalanceMap: Record<string, { name: string; color: string; amount: number }> = {};
  
  for (const group of groups) {
    const balances = await calculateGroupBalances(group.id);
    const myBalance = balances.find(b => b.userId === currentUser.id);
    
    if (!myBalance) continue;
    
    // For each other member, calculate pairwise
    const debts = await getSimplifiedDebts(group.id);
    for (const debt of debts) {
      if (debt.from.id === currentUser.id) {
        // I owe them
        const key = debt.to.id;
        if (!userBalanceMap[key]) userBalanceMap[key] = { name: debt.to.name, color: debt.to.avatar_color, amount: 0 };
        userBalanceMap[key].amount -= debt.amount;
      } else if (debt.to.id === currentUser.id) {
        // They owe me
        const key = debt.from.id;
        if (!userBalanceMap[key]) userBalanceMap[key] = { name: debt.from.name, color: debt.from.avatar_color, amount: 0 };
        userBalanceMap[key].amount += debt.amount;
      }
    }
  }
  
  let totalOwed = 0;
  let totalOwe = 0;
  const balancesByUser: Balance[] = [];
  
  for (const [userId, data] of Object.entries(userBalanceMap)) {
    if (Math.abs(data.amount) > 0.01) {
      if (data.amount > 0) totalOwed += data.amount;
      else totalOwe += Math.abs(data.amount);
      
      balancesByUser.push({
        userId,
        userName: data.name,
        avatarColor: data.color,
        amount: Math.round(data.amount * 100) / 100,
      });
    }
  }
  
  balancesByUser.sort((a, b) => b.amount - a.amount);
  
  return {
    totalOwed: Math.round(totalOwed * 100) / 100,
    totalOwe: Math.round(totalOwe * 100) / 100,
    balancesByUser,
  };
}

// ======== ANALYTICS QUERIES ========

export type CategorySpending = {
  category: string;
  total: number;
};

export type MonthlySpending = {
  month: string; // "YYYY-MM"
  label: string; // "Jan", "Feb", etc.
  total: number;
};

/**
 * Get spending totals grouped by category for a given month/year.
 * Uses current user's share amounts (not the full expense).
 */
export async function getSpendingByCategory(
  month: number, // 1-12
  year: number
): Promise<CategorySpending[]> {
  const db = await getDatabase();
  const currentUser = await getCurrentUser();

  // Build epoch range for the month
  const start = new Date(year, month - 1, 1).getTime();
  const end = new Date(year, month, 1).getTime();

  const rows = await db.getAllAsync<CategorySpending>(`
    SELECT e.category, SUM(es.share_amount) as total
    FROM expense_shares es
    INNER JOIN expenses e ON es.expense_id = e.id
    WHERE es.user_id = ?
      AND e.created_at >= ?
      AND e.created_at < ?
    GROUP BY e.category
    ORDER BY total DESC
  `, [currentUser.id, start, end]);

  return rows;
}

/**
 * Get monthly spending totals for the last N months (based on current user's shares).
 */
export async function getMonthlySpending(lastNMonths: number = 6): Promise<MonthlySpending[]> {
  const db = await getDatabase();
  const currentUser = await getCurrentUser();
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - (lastNMonths - 1), 1).getTime();
  const rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  // Single query instead of N sequential queries
  const rows = await db.getAllAsync<{ month_key: string; total: number }>(`
    SELECT strftime('%Y-%m', datetime(e.created_at / 1000, 'unixepoch')) as month_key,
           SUM(es.share_amount) as total
    FROM expense_shares es
    INNER JOIN expenses e ON es.expense_id = e.id
    WHERE es.user_id = ?
      AND e.created_at >= ?
      AND e.created_at < ?
    GROUP BY month_key
    ORDER BY month_key ASC
  `, [currentUser.id, rangeStart, rangeEnd]);

  const totalsMap: Record<string, number> = {};
  for (const row of rows) {
    totalsMap[row.month_key] = Math.round(row.total * 100) / 100;
  }

  const months: MonthlySpending[] = [];
  for (let i = lastNMonths - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      month: monthKey,
      label: monthLabels[d.getMonth()],
      total: totalsMap[monthKey] ?? 0,
    });
  }

  return months;
}

/**
 * Get total spending for a given month.
 */
export async function getTotalSpendingForMonth(month: number, year: number): Promise<number> {
  const db = await getDatabase();
  const currentUser = await getCurrentUser();
  const start = new Date(year, month - 1, 1).getTime();
  const end = new Date(year, month, 1).getTime();

  const row = await db.getFirstAsync<{ total: number }>(`
    SELECT COALESCE(SUM(es.share_amount), 0) as total
    FROM expense_shares es
    INNER JOIN expenses e ON es.expense_id = e.id
    WHERE es.user_id = ?
      AND e.created_at >= ?
      AND e.created_at < ?
  `, [currentUser.id, start, end]);

  return Math.round((row?.total ?? 0) * 100) / 100;
}

// ----------------------------------------------------------------------------
// Comments & Search
// ----------------------------------------------------------------------------

export interface ExpenseComment {
  id: string;
  expense_id: string;
  user_id: string;
  text: string;
  created_at: number;
  user_name?: string;
  user_avatar_color?: string;
}

export async function addExpenseComment(expenseId: string, text: string): Promise<ExpenseComment> {
  const db = await getDatabase();
  const currentUser = await getCurrentUser();
  const id = Crypto.randomUUID();
  const now = Date.now();

  await db.runAsync(
    'INSERT INTO expense_comments (id, expense_id, user_id, text, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, expenseId, currentUser.id, text, now]
  );
  
  // Trigger background sync
  require('./sync').pushToCloud().catch(console.error);

  return {
    id,
    expense_id: expenseId,
    user_id: currentUser.id,
    text,
    created_at: now,
    user_name: currentUser.name,
    user_avatar_color: currentUser.avatar_color,
  };
}

export async function getExpenseComments(expenseId: string): Promise<ExpenseComment[]> {
  const db = await getDatabase();
  return db.getAllAsync<ExpenseComment>(`
    SELECT c.*, u.name as user_name, u.avatar_color as user_avatar_color
    FROM expense_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.expense_id = ?
    ORDER BY c.created_at ASC
  `, [expenseId]);
}

export async function searchExpenses(query: string): Promise<any[]> {
  const db = await getDatabase();
  const lowerQuery = `%${query.toLowerCase()}%`;
  
  return db.getAllAsync(`
    SELECT e.*, g.name as group_name, u.name as creator_name
    FROM expenses e
    JOIN groups_ g ON e.group_id = g.id
    JOIN users u ON e.created_by = u.id
    WHERE LOWER(e.description) LIKE ? OR LOWER(e.category) LIKE ? OR LOWER(g.name) LIKE ?
    ORDER BY e.created_at DESC
    LIMIT 20
  `, [lowerQuery, lowerQuery, lowerQuery]);
}

// ======== RECURRING LOGIC ========

export async function processRecurringExpenses(): Promise<void> {
  const db = await getDatabase();
  const parents = await db.getAllAsync<Expense>(
    'SELECT * FROM expenses WHERE is_recurring_parent = 1 AND recurring_type != "none"'
  );
  
  const now = Date.now();
  
  // Pre-fetch payers/shares once per parent to avoid repeated queries
  for (const parent of parents) {
    const lastGen = parent.recurring_last_generated || parent.created_at;

    // Collect all due timestamps with a hard cap to prevent infinite generation
    // Max catch-up: 52 weeks / 24 months / 10 years
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

    const [payers, shares] = await Promise.all([
      getExpensePayers(parent.id),
      getExpenseShares(parent.id),
    ]);

    for (const dueAt of dueDates) {
      const newId = Crypto.randomUUID();
      await db.runAsync(
        'INSERT INTO expenses (id, group_id, description, amount, currency, category, split_type, receipt_uri, created_by, recurring_type, is_recurring_parent, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)',
        [newId, parent.group_id, parent.description, parent.amount, parent.currency, parent.category, parent.split_type, parent.receipt_uri, parent.created_by, 'none', parent.notes || null, dueAt, dueAt]
      );
      for (const p of payers) {
        await db.runAsync('INSERT OR REPLACE INTO expense_payers (expense_id, user_id, amount) VALUES (?, ?, ?)', [newId, p.user_id, p.amount]);
      }
      for (const s of shares) {
        await db.runAsync('INSERT OR REPLACE INTO expense_shares (expense_id, user_id, share_amount) VALUES (?, ?, ?)', [newId, s.user_id, s.share_amount]);
      }
    }

    // Advance last generated to the most recent due date
    await db.runAsync(
      'UPDATE expenses SET recurring_last_generated = ?, updated_at = ? WHERE id = ?',
      [dueDates[dueDates.length - 1], now, parent.id]
    );

    console.log(`Generated ${dueDates.length} recurring instance(s) for: ${parent.description}`);
  }
}
