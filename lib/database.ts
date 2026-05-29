/**
 * Splitmaro Database Layer - Online-Only Implementation
 * Bypasses SQLite and calls Node.js/Express backend directly.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AvatarColors } from '../constants/Colors';
import { api, apiRequest } from './api';
export { apiRequest };

const getApiUrl = () => {
  let url = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
  if (url.startsWith('"') && url.endsWith('"')) {
    url = url.slice(1, -1);
  }
  return url;
};

export function formatReceiptUri(uri: string | null): string | null {
  if (!uri) return null;
  if (uri.startsWith('/uploads/')) {
    return `${getApiUrl()}${uri}`;
  }
  return uri;
}

export async function uploadReceiptImage(base64: string, filename: string): Promise<string> {
  const result = await apiRequest('/api/upload', {
    method: 'POST',
    body: JSON.stringify({ base64, name: filename })
  });
  if (!result || !result.url) {
    throw new Error('Failed to upload image: No URL returned from server');
  }
  return result.url;
}

export async function getDatabase(): Promise<any> {
  return null;
}

// ======== USER OPERATIONS ========

export type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  avatar_color: string;
  avatar_url: string | null;
  upi_id: string | null;
  is_pro: number;
  is_admin: number;
  budget_amount: number | null;
  is_current_user: number;
  created_at: number;
};

export async function getCurrentUser(): Promise<User> {
  const cached = await AsyncStorage.getItem('current_user_profile');
  if (cached) {
    return JSON.parse(cached);
  }
  const user = await apiRequest('/api/users/me');
  if (user) {
    const mapped: User = {
      id: user.id,
      name: user.name,
      email: user.email ?? null,
      phone: user.phone ?? null,
      avatar_color: user.avatar_color,
      avatar_url: user.avatar_url ?? null,
      upi_id: user.upi_id ?? null,
      is_pro: user.is_pro ? 1 : 0,
      is_admin: user.is_admin ? 1 : 0,
      budget_amount: user.budget_amount ? Number(user.budget_amount) : null,
      is_current_user: 1,
      created_at: Number(user.created_at),
    };
    await AsyncStorage.setItem('current_user_profile', JSON.stringify(mapped));
    return mapped;
  }
  throw new Error('No user exists in the app. Please sign in or create an account');
}

export async function refreshCurrentUser(): Promise<User> {
  const user = await apiRequest('/api/users/me');
  if (user) {
    const mapped: User = {
      id: user.id,
      name: user.name,
      email: user.email ?? null,
      phone: user.phone ?? null,
      avatar_color: user.avatar_color,
      avatar_url: user.avatar_url ?? null,
      upi_id: user.upi_id ?? null,
      is_pro: user.is_pro ? 1 : 0,
      is_admin: user.is_admin ? 1 : 0,
      budget_amount: user.budget_amount ? Number(user.budget_amount) : null,
      is_current_user: 1,
      created_at: Number(user.created_at),
    };
    await AsyncStorage.setItem('current_user_profile', JSON.stringify(mapped));
    return mapped;
  }
  throw new Error('Failed to refresh user profile from backend');
}

/**
 * Called after a successful login/signup to replace the ephemeral local user
 * with the real server-authenticated user.
 */
export async function setupLocalUserFromAuth(serverUser: {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  avatar_color: string;
  avatar_url?: string | null;
  upi_id?: string | null;
  is_pro?: number | boolean;
  budget_amount?: number | null;
  created_at?: number | string | bigint;
  updated_at?: number | string | bigint;
}): Promise<void> {
  const user: User = {
    id: serverUser.id,
    name: serverUser.name,
    email: serverUser.email ?? null,
    phone: serverUser.phone ?? null,
    avatar_color: serverUser.avatar_color,
    avatar_url: serverUser.avatar_url ?? null,
    upi_id: serverUser.upi_id ?? null,
    is_pro: serverUser.is_pro ? 1 : 0,
    is_admin: (serverUser as any).is_admin ? 1 : 0,
    budget_amount: serverUser.budget_amount ? Number(serverUser.budget_amount) : null,
    is_current_user: 1,
    created_at: serverUser.created_at ? Number(serverUser.created_at) : Date.now(),
  };
  await AsyncStorage.setItem('current_user_profile', JSON.stringify(user));
}

/**
 * Wipes local cache.
 */
export async function clearLocalDatabase(): Promise<void> {
  // No-op in online-only
}

export async function clearAllLocalData(): Promise<void> {
  await AsyncStorage.clear();
  await api.logout();
}

export async function getUser(id: string): Promise<User | null> {
  const currentUser = await getCurrentUser().catch(() => null);
  if (currentUser && currentUser.id === id) {
    return currentUser;
  }
  try {
    const u = await apiRequest(`/api/users/${id}`);
    if (!u) return null;
    return {
      id: u.id,
      name: u.name,
      email: u.email ?? null,
      phone: u.phone ?? null,
      avatar_color: u.avatar_color,
      avatar_url: u.avatar_url ?? null,
      upi_id: u.upi_id ?? null,
      is_pro: u.is_pro ? 1 : 0,
      is_admin: u.is_admin ? 1 : 0,
      budget_amount: u.budget_amount ? Number(u.budget_amount) : null,
      is_current_user: currentUser && currentUser.id === u.id ? 1 : 0,
      created_at: Number(u.created_at),
    };
  } catch (e) {
    console.warn(`[getUser] Failed to fetch user ${id}:`, e);
    return null;
  }
}

export async function getAllFriends(): Promise<User[]> {
  try {
    const friends = await apiRequest('/api/users/friends');
    if (!friends) return [];
    return friends.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email ?? null,
      phone: u.phone ?? null,
      avatar_color: u.avatar_color,
      avatar_url: u.avatar_url ?? null,
      upi_id: u.upi_id ?? null,
      is_pro: u.is_pro ? 1 : 0,
      is_admin: u.is_admin ? 1 : 0,
      budget_amount: u.budget_amount ? Number(u.budget_amount) : null,
      is_current_user: 0,
      created_at: Number(u.created_at),
    }));
  } catch (e) {
    console.error('[getAllFriends] Error:', e);
    return [];
  }
}

export async function addFriend(name: string, email?: string, phone?: string, avatarColor?: string): Promise<User> {
  const trimmedName = name.trim();
  const trimmedEmail = email?.trim().toLowerCase() || null;
  const trimmedPhone = phone?.trim() || null;
  const finalColor = avatarColor || AvatarColors[Math.floor(Math.random() * AvatarColors.length)];

  const friend = await apiRequest('/api/users/friends', {
    method: 'POST',
    body: JSON.stringify({
      name: trimmedName,
      email: trimmedEmail,
      phone: trimmedPhone,
      avatar_color: finalColor,
    }),
  });

  return {
    id: friend.id,
    name: friend.name,
    email: friend.email ?? null,
    phone: friend.phone ?? null,
    avatar_color: friend.avatar_color,
    avatar_url: friend.avatar_url ?? null,
    upi_id: friend.upi_id ?? null,
    is_pro: friend.is_pro ? 1 : 0,
    is_admin: friend.is_admin ? 1 : 0,
    budget_amount: friend.budget_amount ? Number(friend.budget_amount) : null,
    is_current_user: 0,
    created_at: Number(friend.created_at),
  };
}

export async function updateUser(
  id: string,
  updates: Partial<Pick<User, 'name' | 'email' | 'phone' | 'avatar_color' | 'upi_id' | 'is_pro' | 'budget_amount'>>
): Promise<void> {
  const currentUser = await getCurrentUser().catch(() => null);
  const path = (currentUser && currentUser.id === id) ? '/api/users/me' : `/api/users/${id}`;
  
  const updated = await apiRequest(path, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });

  if (currentUser && currentUser.id === id && updated) {
    const mapped: User = {
      ...currentUser,
      name: updated.name ?? currentUser.name,
      email: updated.email !== undefined ? updated.email : currentUser.email,
      phone: updated.phone !== undefined ? updated.phone : currentUser.phone,
      avatar_color: updated.avatar_color ?? currentUser.avatar_color,
      avatar_url: updated.avatar_url ?? currentUser.avatar_url ?? null,
      upi_id: updated.upi_id !== undefined ? updated.upi_id : currentUser.upi_id,
      is_pro: updated.is_pro ? 1 : 0,
      budget_amount: updated.budget_amount !== undefined ? (updated.budget_amount ? Number(updated.budget_amount) : null) : currentUser.budget_amount,
    };
    await AsyncStorage.setItem('current_user_profile', JSON.stringify(mapped));
  }
}

export async function deleteFriend(id: string): Promise<void> {
  await apiRequest(`/api/users/friends/${id}`, {
    method: 'DELETE',
  });
}

export async function syncRevenueCatProStatus(): Promise<User> {
  const response = await apiRequest('/api/payment/revenuecat-sync', {
    method: 'POST'
  });
  if (response && response.success && response.user) {
    const mapped: User = {
      id: response.user.id,
      name: response.user.name,
      email: response.user.email ?? null,
      phone: response.user.phone ?? null,
      avatar_color: response.user.avatar_color,
      avatar_url: response.user.avatar_url ?? null,
      upi_id: response.user.upi_id ?? null,
      is_pro: response.user.is_pro ? 1 : 0,
      is_admin: response.user.is_admin ? 1 : 0,
      budget_amount: response.user.budget_amount ? Number(response.user.budget_amount) : null,
      is_current_user: 1,
      created_at: Number(response.user.created_at),
    };
    await AsyncStorage.setItem('current_user_profile', JSON.stringify(mapped));
    return mapped;
  }
  throw new Error('Failed to synchronize Pro status with backend');
}

export async function getFriendRequests(): Promise<User[]> {
  try {
    const requests = await apiRequest('/api/users/friends/requests');
    if (!requests) return [];
    return requests.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email ?? null,
      phone: u.phone ?? null,
      avatar_color: u.avatar_color,
      avatar_url: u.avatar_url ?? null,
      upi_id: u.upi_id ?? null,
      is_pro: u.is_pro ? 1 : 0,
      is_admin: u.is_admin ? 1 : 0,
      budget_amount: u.budget_amount ? Number(u.budget_amount) : null,
      is_current_user: 0,
      created_at: Number(u.created_at),
    }));
  } catch (e) {
    console.error('[getFriendRequests] Error:', e);
    return [];
  }
}

export async function acceptFriendRequest(id: string): Promise<void> {
  await apiRequest(`/api/users/friends/${id}/accept`, {
    method: 'POST',
  });
}

export async function declineFriendRequest(id: string): Promise<void> {
  await apiRequest(`/api/users/friends/${id}/decline`, {
    method: 'POST',
  });
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
  try {
    const groups = await apiRequest('/api/groups');
    return groups ? groups.length : 0;
  } catch (e) {
    console.error('[getGroupsCount] Error:', e);
    return 0;
  }
}

export async function getAllGroups(): Promise<Group[]> {
  try {
    const groups = await apiRequest('/api/groups');
    if (!groups) return [];
    return groups.map((g: any) => ({
      id: g.id,
      name: g.name,
      category: g.category,
      cover_image: g.cover_image ?? null,
      created_by: g.created_by ?? null,
      created_at: Number(g.created_at),
      updated_at: Number(g.updated_at),
      member_count: g.member_count ?? 0,
    }));
  } catch (e) {
    console.error('[getAllGroups] Error:', e);
    return [];
  }
}

/**
 * Returns the current user's net balance (positive = owed, negative = owes) for each group.
 */
export async function getGroupBalancesForCurrentUser(): Promise<Record<string, number>> {
  try {
    const balances = await apiRequest('/api/users/me/group-balances');
    return balances || {};
  } catch (e) {
    console.error('[getGroupBalancesForCurrentUser] Error:', e);
    return {};
  }
}

export async function getGroup(id: string): Promise<Group | null> {
  try {
    const group = await apiRequest(`/api/groups/${id}`);
    if (!group) return null;
    return {
      id: group.id,
      name: group.name,
      category: group.category || 'other',
      cover_image: group.cover_image ?? null,
      created_by: group.created_by ?? null,
      created_at: Number(group.created_at),
      updated_at: Number(group.updated_at),
      member_count: group.member_count ?? 0,
    };
  } catch (e) {
    console.error(`[getGroup] Error fetching group ${id}:`, e);
    return null;
  }
}

export async function createGroup(name: string, category: string, memberIds: string[]): Promise<Group> {
  const group = await apiRequest('/api/groups', {
    method: 'POST',
    body: JSON.stringify({ name, category, memberIds }),
  });
  return {
    id: group.id,
    name: group.name,
    category: group.category || 'other',
    cover_image: group.cover_image ?? null,
    created_by: group.created_by ?? null,
    created_at: Number(group.created_at),
    updated_at: Number(group.updated_at),
    member_count: group.member_count ?? 0,
  };
}

export async function updateGroup(id: string, updates: Partial<Pick<Group, 'name' | 'category'>>): Promise<void> {
  await apiRequest(`/api/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteGroup(id: string): Promise<void> {
  await apiRequest(`/api/groups/${id}`, {
    method: 'DELETE',
  });
}

export async function getGroupMembers(groupId: string): Promise<User[]> {
  try {
    const currentUser = await getCurrentUser().catch(() => null);
    const members = await apiRequest(`/api/groups/${groupId}/members`);
    if (!members) return [];
    return members.map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email ?? null,
      phone: u.phone ?? null,
      avatar_color: u.avatar_color,
      upi_id: u.upi_id ?? null,
      is_pro: u.is_pro ? 1 : 0,
      is_admin: u.is_admin ? 1 : 0,
      budget_amount: u.budget_amount ? Number(u.budget_amount) : null,
      is_current_user: currentUser && currentUser.id === u.id ? 1 : 0,
      created_at: Number(u.created_at),
    }));
  } catch (e) {
    console.error(`[getGroupMembers] Error for group ${groupId}:`, e);
    return [];
  }
}

export async function addGroupMember(groupId: string, userId: string): Promise<void> {
  await apiRequest(`/api/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  await apiRequest(`/api/groups/${groupId}/members/${userId}`, {
    method: 'DELETE',
  });
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
  try {
    const expenses = await apiRequest(`/api/groups/${groupId}/expenses`);
    if (!expenses) return [];
    return expenses.map((e: any) => ({
      id: e.id,
      group_id: e.group_id,
      description: e.description,
      amount: e.amount,
      currency: e.currency || 'INR',
      category: e.category || 'general',
      split_type: e.split_type || 'equal',
      receipt_uri: formatReceiptUri(e.receipt_uri ?? null),
      created_by: e.created_by,
      recurring_type: e.recurring_type ?? null,
      recurring_last_generated: e.recurring_last_generated ? Number(e.recurring_last_generated) : null,
      is_recurring_parent: e.is_recurring_parent ? 1 : 0,
      created_at: Number(e.created_at),
      updated_at: Number(e.updated_at),
      notes: e.notes ?? null,
      creator_name: e.creator_name,
      group_name: e.group_name,
    }));
  } catch (e) {
    console.error(`[getGroupExpenses] Error for group ${groupId}:`, e);
    return [];
  }
}

export async function getAllExpenses(): Promise<Expense[]> {
  try {
    const expenses = await apiRequest('/api/expenses');
    if (!expenses) return [];
    return expenses.map((e: any) => ({
      id: e.id,
      group_id: e.group_id,
      description: e.description,
      amount: e.amount,
      currency: e.currency || 'INR',
      category: e.category || 'general',
      split_type: e.split_type || 'equal',
      receipt_uri: formatReceiptUri(e.receipt_uri ?? null),
      created_by: e.created_by,
      recurring_type: e.recurring_type ?? null,
      recurring_last_generated: e.recurring_last_generated ? Number(e.recurring_last_generated) : null,
      is_recurring_parent: e.is_recurring_parent ? 1 : 0,
      created_at: Number(e.created_at),
      updated_at: Number(e.updated_at),
      notes: e.notes ?? null,
      creator_name: e.creator_name,
      group_name: e.group_name,
    }));
  } catch (e) {
    console.error('[getAllExpenses] Error:', e);
    return [];
  }
}

export async function getExpense(id: string): Promise<Expense | null> {
  try {
    const e = await apiRequest(`/api/expenses/${id}`);
    if (!e) return null;
    return {
      id: e.id,
      group_id: e.group_id,
      description: e.description,
      amount: e.amount,
      currency: e.currency || 'INR',
      category: e.category || 'general',
      split_type: e.split_type || 'equal',
      receipt_uri: formatReceiptUri(e.receipt_uri ?? null),
      created_by: e.created_by,
      recurring_type: e.recurring_type ?? null,
      recurring_last_generated: e.recurring_last_generated ? Number(e.recurring_last_generated) : null,
      is_recurring_parent: e.is_recurring_parent ? 1 : 0,
      created_at: Number(e.created_at),
      updated_at: Number(e.updated_at),
      notes: e.notes ?? null,
      creator_name: e.creator_name,
      group_name: e.group_name,
    };
  } catch (e) {
    console.error(`[getExpense] Error for expense ${id}:`, e);
    return null;
  }
}

export async function getExpensePayers(expenseId: string): Promise<ExpensePayer[]> {
  try {
    const payers = await apiRequest(`/api/expenses/${expenseId}/payers`);
    if (!payers) return [];
    return payers.map((p: any) => ({
      expense_id: p.expense_id,
      user_id: p.user_id,
      amount: p.amount,
      name: p.name,
    }));
  } catch (e) {
    console.error(`[getExpensePayers] Error for expense ${expenseId}:`, e);
    return [];
  }
}

export async function getExpenseShares(expenseId: string): Promise<ExpenseShare[]> {
  try {
    const shares = await apiRequest(`/api/expenses/${expenseId}/shares`);
    if (!shares) return [];
    return shares.map((s: any) => ({
      expense_id: s.expense_id,
      user_id: s.user_id,
      share_amount: s.share_amount,
      name: s.name,
    }));
  } catch (e) {
    console.error(`[getExpenseShares] Error for expense ${expenseId}:`, e);
    return [];
  }
}

export async function getExpenseDetailsForGroup(groupId: string): Promise<{
  payersByExpense: Record<string, ExpensePayer[]>;
  sharesByExpense: Record<string, ExpenseShare[]>;
}> {
  try {
    const details = await apiRequest(`/api/groups/${groupId}/expense-details`);
    return details || { payersByExpense: {}, sharesByExpense: {} };
  } catch (e) {
    console.error(`[getExpenseDetailsForGroup] Error for group ${groupId}:`, e);
    return { payersByExpense: {}, sharesByExpense: {} };
  }
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
  const id = await apiRequest('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return id;
}

export async function updateExpense(id: string, input: Partial<CreateExpenseInput>): Promise<void> {
  await apiRequest(`/api/expenses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  await apiRequest(`/api/expenses/${id}`, {
    method: 'DELETE',
  });
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
  try {
    const settlements = await apiRequest(`/api/groups/${groupId}/settlements`);
    if (!settlements) return [];
    return settlements.map((s: any) => ({
      id: s.id,
      group_id: s.group_id,
      payer_id: s.payer_id,
      payee_id: s.payee_id,
      amount: s.amount,
      note: s.note ?? null,
      created_at: Number(s.created_at),
      payer_name: s.payer_name,
      payee_name: s.payee_name,
      group_name: s.group_name,
    }));
  } catch (e) {
    console.error(`[getGroupSettlements] Error for group ${groupId}:`, e);
    return [];
  }
}

export async function createSettlement(
  groupId: string,
  payerId: string,
  payeeId: string,
  amount: number,
  note?: string
): Promise<string> {
  const id = await apiRequest('/api/settlements', {
    method: 'POST',
    body: JSON.stringify({ groupId, payerId, payeeId, amount, note }),
  });
  return id;
}

// ======== BALANCE CALCULATIONS ========

export type Balance = {
  userId: string;
  userName: string;
  userEmail?: string;
  avatarColor: string;
  avatarUrl?: string | null;
  amount: number;
};

export type DebtEdge = {
  from: User;
  to: User;
  amount: number;
};

export async function calculateGroupBalances(groupId: string): Promise<Balance[]> {
  try {
    const balances = await apiRequest(`/api/groups/${groupId}/balances`);
    if (!balances) return [];
    return balances.map((b: any) => ({
      userId: b.userId,
      userName: b.userName,
      userEmail: b.userEmail ?? undefined,
      avatarColor: b.avatarColor,
      avatarUrl: b.avatarUrl ?? null,
      amount: b.amount,
    }));
  } catch (e) {
    console.error(`[calculateGroupBalances] Error for group ${groupId}:`, e);
    return [];
  }
}

export async function getSimplifiedDebts(groupId: string): Promise<DebtEdge[]> {
  try {
    const debts = await apiRequest(`/api/groups/${groupId}/simplified-debts`);
    if (!debts) return [];
    return debts.map((d: any) => ({
      from: {
        id: d.from.id,
        name: d.from.name,
        email: d.from.email ?? null,
        phone: d.from.phone ?? null,
        avatar_color: d.from.avatar_color,
        upi_id: d.from.upi_id ?? null,
        is_pro: d.from.is_pro ? 1 : 0,
        is_admin: d.from.is_admin ? 1 : 0,
        budget_amount: d.from.budget_amount ? Number(d.from.budget_amount) : null,
        is_current_user: 0,
        created_at: Number(d.from.created_at),
      },
      to: {
        id: d.to.id,
        name: d.to.name,
        email: d.to.email ?? null,
        phone: d.to.phone ?? null,
        avatar_color: d.to.avatar_color,
        upi_id: d.to.upi_id ?? null,
        is_pro: d.to.is_pro ? 1 : 0,
        is_admin: d.to.is_admin ? 1 : 0,
        budget_amount: d.to.budget_amount ? Number(d.to.budget_amount) : null,
        is_current_user: 0,
        created_at: Number(d.to.created_at),
      },
      amount: d.amount,
    }));
  } catch (e) {
    console.error(`[getSimplifiedDebts] Error for group ${groupId}:`, e);
    return [];
  }
}

// ======== OVERALL BALANCE ========

export async function getOverallBalance(): Promise<{ totalOwed: number; totalOwe: number; balancesByUser: Balance[] }> {
  try {
    const data = await apiRequest('/api/users/me/overall-balance');
    if (!data) return { totalOwed: 0, totalOwe: 0, balancesByUser: [] };
    return {
      totalOwed: data.totalOwed,
      totalOwe: data.totalOwe,
      balancesByUser: (data.balancesByUser || []).map((b: any) => ({
        userId: b.userId,
        userName: b.userName,
        avatarColor: b.avatarColor,
        avatarUrl: b.avatarUrl ?? null,
        amount: b.amount,
      })),
    };
  } catch (e) {
    console.error('[getOverallBalance] Error:', e);
    return { totalOwed: 0, totalOwe: 0, balancesByUser: [] };
  }
}

// ======== ANALYTICS QUERIES ========

export type CategorySpending = {
  category: string;
  total: number;
};

export type MonthlySpending = {
  month: string;
  label: string;
  total: number;
};

export async function getSpendingByCategory(month: number, year: number): Promise<CategorySpending[]> {
  try {
    const data = await apiRequest(`/api/users/me/spending-by-category?month=${month}&year=${year}`);
    return data || [];
  } catch (e) {
    console.error('[getSpendingByCategory] Error:', e);
    return [];
  }
}

export async function getMonthlySpending(lastNMonths: number = 6): Promise<MonthlySpending[]> {
  try {
    const data = await apiRequest(`/api/users/me/monthly-spending?lastNMonths=${lastNMonths}`);
    return data || [];
  } catch (e) {
    console.error('[getMonthlySpending] Error:', e);
    return [];
  }
}

export async function getTotalSpendingForMonth(month: number, year: number): Promise<number> {
  try {
    const data = await apiRequest(`/api/users/me/total-spending-for-month?month=${month}&year=${year}`);
    return typeof data === 'number' ? data : 0;
  } catch (e) {
    console.error('[getTotalSpendingForMonth] Error:', e);
    return 0;
  }
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
  const comment = await apiRequest(`/api/expenses/${expenseId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
  return comment;
}

export async function getExpenseComments(expenseId: string): Promise<ExpenseComment[]> {
  try {
    const comments = await apiRequest(`/api/expenses/${expenseId}/comments`);
    return comments || [];
  } catch (e) {
    console.error(`[getExpenseComments] Error for expense ${expenseId}:`, e);
    return [];
  }
}

export async function searchExpenses(query: string): Promise<any[]> {
  try {
    const q = encodeURIComponent(query);
    const expenses = await apiRequest(`/api/expenses/search?q=${q}`);
    return expenses || [];
  } catch (e) {
    console.error('[searchExpenses] Error:', e);
    return [];
  }
}

// ======== RECURRING LOGIC ========

export async function processRecurringExpenses(): Promise<void> {
  // No-op: handled automatically on the backend
}
