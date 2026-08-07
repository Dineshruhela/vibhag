/**
 * useNotifications hook
 * Initializes notification permissions and schedules reminders
 * based on current outstanding balances.
 */
import {
    getPushToken,
    requestNotificationPermissions,
    scheduleDailyDebtReminder,
    scheduleWeeklySummary,
} from '@/lib/notifications';
import { api } from '@/lib/api';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, DeviceEventEmitter, Platform } from 'react-native';
import { getAllExpenses, getOverallBalance } from '../lib/database';

export function useNotifications() {
  const router = useRouter();
  const appState = useRef(AppState.currentState);

  // Register the device token after authentication. This is intentionally
  // retried on auth changes so login, logout/login, and token refreshes all
  // associate the current device with the correct account.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const registerDevice = async () => {
      try {
        if (!(await api.getToken())) return;
        const pushToken = await getPushToken();
        if (pushToken) await api.registerPushToken(pushToken);
      } catch (e) {
        console.warn('[Notifications] Failed to register device token:', e);
      }
    };

    registerDevice();
    const authChangeSub = DeviceEventEmitter.addListener('auth_change', registerDevice);
    const appStateSub = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') registerDevice();
    });
    return () => {
      authChangeSub.remove();
      appStateSub.remove();
    };
  }, []);

  // Handle notification tap — navigate to the right screen
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as { type?: string; expenseId?: string; groupId?: string };
      const type = data?.type;
      if (type === 'debt_reminder') {
        router.push('/(tabs)' as any);
      } else if (type === 'weekly_summary') {
        router.push('/(tabs)/activity' as any);
      } else if (type === 'expense_added') {
        router.push(data?.expenseId ? `/group/expense/${data.expenseId}` as any : '/(tabs)/activity' as any);
      } else if (type === 'friend_request' || type === 'friend_accepted') {
        router.push('/(tabs)/friends' as any);
      } else if (type === 'group_member_added' || type === 'group_member_joined') {
        router.push(data?.groupId ? `/group/${data.groupId}` as any : '/(tabs)/groups' as any);
      }
    });

    return () => sub.remove();
  }, [router]);

  // Schedule/reschedule notifications when app comes to foreground
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const scheduleReminders = async () => {
      const granted = await requestNotificationPermissions();
      if (!granted) return;

      try {
        const [balance, expenses] = await Promise.all([
          getOverallBalance(),
          getAllExpenses(),
        ]);

        await scheduleDailyDebtReminder(balance.totalOwed, balance.totalOwe);

        // Weekly summary: total of all expenses this week
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const weeklyTotal = expenses
          .filter(e => e.created_at >= oneWeekAgo)
          .reduce((sum, e) => sum + e.amount, 0);
        await scheduleWeeklySummary(weeklyTotal);
      } catch (e) {
        console.warn('Failed to schedule notifications:', e);
      }
    };

    // Run on mount
    scheduleReminders();

    // Re-run when app comes back to foreground
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        scheduleReminders();
      }
      appState.current = nextState;
    });

    return () => sub.remove();
  }, []);
}
