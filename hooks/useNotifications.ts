/**
 * useNotifications hook
 * Initializes notification permissions and schedules reminders
 * based on current outstanding balances.
 */
import {
    requestNotificationPermissions,
    scheduleDailyDebtReminder,
    scheduleWeeklySummary,
} from '@/lib/notifications';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { getAllExpenses, getOverallBalance } from '../lib/database';

export function useNotifications() {
  const router = useRouter();
  const appState = useRef(AppState.currentState);

  // Handle notification tap — navigate to the right screen
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const type = response.notification.request.content.data?.type;
      if (type === 'debt_reminder') {
        router.push('/(tabs)' as any);
      } else if (type === 'weekly_summary') {
        router.push('/(tabs)/activity' as any);
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
