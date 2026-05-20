import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { api } from './api';
import { getDatabase, processRecurringExpenses } from './database';
import { supabase } from './supabase';

const LAST_SYNC_KEY = 'last_sync_timestamp';

/**
 * Pushes all local SQLite data up to Backend API.
 */
export async function pushToCloud() {
  const db = await getDatabase();
  const token = await api.getToken();
  
  if (!token) {
    console.log('[Sync] Not signed in, skipping push.');
    return;
  }
  
  console.log('[Sync] Pushing data to Backend API...');
  try {
    // 1. Fetch all local data
    const users = await db.getAllAsync('SELECT * FROM users');
    const groups = await db.getAllAsync('SELECT * FROM groups_');
    const groupMembers = await db.getAllAsync('SELECT * FROM group_members');
    const expenses: any[] = await db.getAllAsync('SELECT * FROM expenses');
    const expensePayers = await db.getAllAsync('SELECT * FROM expense_payers');
    const expenseShares = await db.getAllAsync('SELECT * FROM expense_shares');
    const settlements = await db.getAllAsync('SELECT * FROM settlements');
    const comments = await db.getAllAsync('SELECT * FROM expense_comments');

    // 2. Handle Receipt Uploads (Keeping Supabase Storage for now)
    for (const e of expenses) {
      if (e.receipt_uri && e.receipt_uri.startsWith('file://')) {
        try {
          const { decode } = require('base64-arraybuffer');
          const FileSystem = require('expo-file-system');
          const base64 = await FileSystem.readAsStringAsync(e.receipt_uri, { encoding: 'base64' });
          const ext = e.receipt_uri.split('.').pop() || 'jpg';
          const fileName = `${e.id}.${ext}`;
          
          const { data, error } = await supabase.storage.from('receipts').upload(fileName, decode(base64), { contentType: `image/${ext}`, upsert: true });
          
          if (!error && data) {
             const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
             e.receipt_uri = publicUrl;
             await db.runAsync('UPDATE expenses SET receipt_uri = ? WHERE id = ?', [publicUrl, e.id]);
          }
        } catch (err) {
          console.warn("[Sync] Receipt upload skipped:", err);
        }
      }
    }

    // 3. Batch Push to Backend API
    await api.push({
      users,
      groups,
      groupMembers,
      expenses,
      expensePayers,
      expenseShares,
      settlements,
      comments
    });

    console.log('[Sync] Backend API Push complete.');
  } catch (error) {
    console.error('[Sync] Backend API Push failed:', error);
  }
}

/**
 * Pulls updated data from Backend API and merges into local SQLite.
 */
export async function pullFromCloud() {
  const db = await getDatabase();
  const token = await api.getToken();
  
  if (!token) {
    console.log('[Sync] Not signed in, skipping pull.');
    return;
  }

  const lastSyncStr = await AsyncStorage.getItem(LAST_SYNC_KEY);
  // Subtract 5 minutes to guard against clock drift between devices —
  // updated_at is set on the creator's device; lastSync on the puller's device.
  const lastSync = lastSyncStr ? Math.max(0, parseInt(lastSyncStr) - 5 * 60 * 1000) : 0;

  console.log(`[Sync] Pulling from Backend API since ${lastSync}...`);
  try {
    const response = await api.pull(lastSync);
    const { users, groups, groupMembers, expenses, expensePayers, expenseShares, settlements, comments, activeGroupIds } = response.data;

    // 0. Reconcile deleted groups/entities from cloud (with foreign keys ON to ensure ON DELETE CASCADE cleans up orphans)
    if (activeGroupIds !== undefined) {
      const localGroups = await db.getAllAsync<{ id: string }>('SELECT id FROM groups_');
      for (const lg of localGroups) {
        if (!activeGroupIds.includes(lg.id)) {
          console.log(`[Sync] Deleting local group ${lg.id} since it was deleted on the cloud.`);
          await db.runAsync('DELETE FROM groups_ WHERE id = ?', [lg.id]);
        }
      }
    }

    // Get current session user ID from JWT
    let sessionUserId: string | null = null;
    try {
      const token = await api.getToken();
      if (token) {
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(typeof atob !== 'undefined' ? atob(payloadBase64) : Buffer.from(payloadBase64, 'base64').toString('utf-8'));
        sessionUserId = payload.userId;
      }
    } catch (e) {
      console.warn('[Sync] Could not decode session user from JWT:', e);
    }

    // Disable foreign keys temporarily during sync merge to prevent out-of-order relation failures
    await db.execAsync('PRAGMA foreign_keys = OFF;');
    try {
      // Use a manual transaction for local SQLite updates to preserve and log the actual query/constraint failure
      await db.execAsync('BEGIN TRANSACTION;');
      try {
        // 1. Users (Using UPSERT instead of REPLACE to avoid ON DELETE CASCADE)
        if (users) {
          for (const u of users) {
            let isCurrentUserLocal = (sessionUserId && u.id === sessionUserId) ? 1 : 0;
            
            // Reconcile by email to prevent duplicate friend accounts with different IDs
            if (u.email) {
              const normalizedEmail = u.email.toLowerCase().trim();
              const existingWithEmail = await db.getFirstAsync<{ id: string, is_current_user: number }>(
                'SELECT id, is_current_user FROM users WHERE LOWER(TRIM(email)) = ?',
                [normalizedEmail]
              );
              
              if (existingWithEmail && existingWithEmail.id !== u.id) {
                console.log(`[Sync] Reconciling duplicate local user by unique email: replacing old ID ${existingWithEmail.id} with server ID ${u.id}`);
                
                // Propagate is_current_user status if the old local record had it
                if (existingWithEmail.is_current_user) {
                  isCurrentUserLocal = 1;
                }
                
                // Update references in all SQLite tables to use the correct server ID
                await db.runAsync('UPDATE group_members SET user_id = ? WHERE user_id = ?', [u.id, existingWithEmail.id]);
                await db.runAsync('UPDATE expense_payers SET user_id = ? WHERE user_id = ?', [u.id, existingWithEmail.id]);
                await db.runAsync('UPDATE expense_shares SET user_id = ? WHERE user_id = ?', [u.id, existingWithEmail.id]);
                await db.runAsync('UPDATE expenses SET created_by = ? WHERE created_by = ?', [u.id, existingWithEmail.id]);
                await db.runAsync('UPDATE settlements SET payer_id = ? WHERE payer_id = ?', [u.id, existingWithEmail.id]);
                await db.runAsync('UPDATE settlements SET payee_id = ? WHERE payee_id = ?', [u.id, existingWithEmail.id]);
                await db.runAsync('UPDATE expense_comments SET user_id = ? WHERE user_id = ?', [u.id, existingWithEmail.id]);
                
                // Safely delete the old duplicate user record
                await db.runAsync('DELETE FROM users WHERE id = ?', [existingWithEmail.id]);
              }
            }

            await db.runAsync(`
              INSERT INTO users (id, name, email, phone, avatar_color, upi_id, is_pro, is_current_user, budget_amount, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                email = excluded.email,
                phone = excluded.phone,
                avatar_color = excluded.avatar_color,
                upi_id = excluded.upi_id,
                is_pro = excluded.is_pro,
                is_current_user = excluded.is_current_user,
                budget_amount = excluded.budget_amount,
                updated_at = excluded.updated_at
            `, [u.id, u.name, u.email, u.phone, u.avatar_color, u.upi_id, u.is_pro, isCurrentUserLocal, u.budget_amount, u.created_at, u.updated_at]);
          }
        }

        // 2. Groups
        if (groups) {
          for (const g of groups) {
            await db.runAsync(`
              INSERT INTO groups_ (id, name, category, cover_image, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                category = excluded.category,
                cover_image = excluded.cover_image,
                created_by = excluded.created_by,
                updated_at = excluded.updated_at
            `, [g.id, g.name, g.category, g.cover_image, g.created_by, g.created_at, g.updated_at]);
          }
        }

        // 3. Group Members
        if (groupMembers) {
          for (const gm of groupMembers) {
            await db.runAsync('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [gm.group_id, gm.user_id]);
          }
        }

        // 4. Expenses
        if (expenses) {
          for (const e of expenses) {
            await db.runAsync(`
              INSERT INTO expenses (id, group_id, description, amount, currency, category, split_type, receipt_uri, notes, recurring_type, recurring_last_generated, is_recurring_parent, created_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                group_id = excluded.group_id,
                description = excluded.description,
                amount = excluded.amount,
                currency = excluded.currency,
                category = excluded.category,
                split_type = excluded.split_type,
                receipt_uri = excluded.receipt_uri,
                notes = excluded.notes,
                recurring_type = excluded.recurring_type,
                recurring_last_generated = excluded.recurring_last_generated,
                is_recurring_parent = excluded.is_recurring_parent,
                updated_at = excluded.updated_at
            `, [e.id, e.group_id, e.description, e.amount, e.currency, e.category, e.split_type, e.receipt_uri, e.notes, e.recurring_type, e.recurring_last_generated, e.is_recurring_parent, e.created_by, e.created_at, e.updated_at]);
          }
        }

        // 5. Payers & Shares
        if (expensePayers) {
          for (const ep of expensePayers) {
            await db.runAsync(`
              INSERT INTO expense_payers (expense_id, user_id, amount)
              VALUES (?, ?, ?)
              ON CONFLICT(expense_id, user_id) DO UPDATE SET amount = excluded.amount
            `, [ep.expense_id, ep.user_id, ep.amount]);
          }
        }
        if (expenseShares) {
          for (const es of expenseShares) {
            await db.runAsync(`
              INSERT INTO expense_shares (expense_id, user_id, share_amount)
              VALUES (?, ?, ?)
              ON CONFLICT(expense_id, user_id) DO UPDATE SET share_amount = excluded.share_amount
            `, [es.expense_id, es.user_id, es.share_amount]);
          }
        }

        // 6. Settlements & Comments
        if (settlements) {
          for (const s of settlements) {
            await db.runAsync(`
              INSERT INTO settlements (id, group_id, payer_id, payee_id, amount, note, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                amount = excluded.amount,
                note = excluded.note
            `, [s.id, s.group_id, s.payer_id, s.payee_id, s.amount, s.note, s.created_at]);
          }
        }
        if (comments) {
          for (const c of comments) {
            await db.runAsync(`
              INSERT INTO expense_comments (id, expense_id, user_id, text, created_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET text = excluded.text
            `, [c.id, c.expense_id, c.user_id, c.text, c.created_at]);
          }
        }

        await db.execAsync('COMMIT;');
      } catch (transactionError) {
        console.error('[Sync] SQLite sync transaction failed:', transactionError);
        try {
          await db.execAsync('ROLLBACK;');
        } catch (rollbackError) {
          console.warn('[Sync] SQLite ROLLBACK failed (might have been rolled back already):', rollbackError);
        }
        throw transactionError;
      }
    } finally {
      // Always re-enable foreign keys
      await db.execAsync('PRAGMA foreign_keys = ON;');
    }

    await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    console.log('[Sync] Backend API Pull complete.');
    DeviceEventEmitter.emit('sync_complete');
  } catch (error) {
    console.error('[Sync] Backend API Pull failed:', error);
  }
}

export async function syncAll() {
  try {
    try {
      await pushToCloud();
    } catch (pushErr) {
      console.error('[Sync] Push phase failed:', pushErr);
    }
    
    try {
      await pullFromCloud();
    } catch (pullErr) {
      console.error('[Sync] Pull phase failed:', pullErr);
    }
    
    await processRecurringExpenses();
  } catch (e) {
    console.error('[Sync] Full sync failed:', e);
  }
}
