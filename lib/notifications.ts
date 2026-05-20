/**
 * Splitmaro Notification System
 * Handles scheduling and managing local push notifications.
 */
import Constants from 'expo-constants';
import type * as NotificationsType from 'expo-notifications';
import { Platform } from 'react-native';

const isExpoGo = Constants.appOwnership === 'expo';

// Dynamic lazy import of expo-notifications to bypass Expo Go SDK 53+ warnings
let Notifications: any = null;
if (Platform.OS !== 'web' && !isExpoGo) {
  try {
    Notifications = require('expo-notifications');
  } catch (e) {
    console.warn('[Notifications] Failed to load native expo-notifications module:', e);
  }
}

// Configure how notifications appear when the app is in the foreground
if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.warn('[Notifications] Failed to set notification handler:', e);
  }
}

export const NOTIFICATION_IDS = {
  DAILY_DEBT_REMINDER: 'daily-debt-reminder',
  WEEKLY_SUMMARY: 'weekly-summary',
};

/**
 * Request notification permissions from the OS.
 * Returns true if granted.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web' || !Notifications) return false;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (e) {
    console.warn('[Notifications] Failed to request permissions:', e);
    return false;
  }
}

/**
 * Get the Expo Push Token for this device.
 */
export async function getPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) return null;

  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;

    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'a3a4d9c4-4ad7-4258-aee1-6e2f1eefdb44', // Project ID from app.json
    })).data;
    return token;
  } catch (e) {
    console.warn('[Notifications] Failed to get push token:', e);
    return null;
  }
}

/**
 * Check if notifications are currently enabled.
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  if (Platform.OS === 'web' || !Notifications) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('[Notifications] Failed to check permission status:', e);
    return false;
  }
}

/**
 * Schedule a daily reminder at 7:00 PM if the user has outstanding debts.
 * Cancels any existing reminder first.
 */
export async function scheduleDailyDebtReminder(
  totalOwed: number = 1,
  totalOwe: number = 1
): Promise<void> {
  if (!Notifications) return;

  try {
    // Cancel existing reminder before rescheduling
    await cancelNotification(NOTIFICATION_IDS.DAILY_DEBT_REMINDER);

    if (totalOwed === 0 && totalOwe === 0) return;

    const granted = await areNotificationsEnabled();
    if (!granted) return;

    let title = '💰 Splitmaro';
    let body = '';

    if (totalOwed > 0 && totalOwe > 0) {
      body = `You're owed ₹${totalOwed.toFixed(0)} and you owe ₹${totalOwe.toFixed(0)}. Time to settle up!`;
    } else if (totalOwed > 0) {
      body = `You're owed ₹${totalOwed.toFixed(0)}. Don't forget to collect!`;
    } else {
      body = `You owe ₹${totalOwe.toFixed(0)}. Time to settle up!`;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.DAILY_DEBT_REMINDER,
      content: {
        title,
        body,
        sound: true,
        badge: 1,
        data: { type: 'debt_reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 19, // 7 PM
        minute: 0,
      },
    });
  } catch (e) {
    console.warn('[Notifications] Failed to schedule daily reminder:', e);
  }
}

/**
 * Schedule a weekly summary every Sunday at 10:00 AM.
 */
export async function scheduleWeeklySummary(totalExpenses: number): Promise<void> {
  if (!Notifications) return;

  try {
    await cancelNotification(NOTIFICATION_IDS.WEEKLY_SUMMARY);

    if (totalExpenses === 0) return;
    const granted = await areNotificationsEnabled();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_IDS.WEEKLY_SUMMARY,
      content: {
        title: '📊 Weekly Summary',
        body: `You tracked ₹${totalExpenses.toFixed(0)} in expenses this week. Tap to see your insights!`,
        sound: true,
        data: { type: 'weekly_summary' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: 1, // Sunday
        hour: 10,
        minute: 0,
      },
    });
  } catch (e) {
    console.warn('[Notifications] Failed to schedule weekly summary:', e);
  }
}

/**
 * Cancel a specific scheduled notification by ID.
 */
export async function cancelNotification(identifier: string): Promise<void> {
  if (!Notifications) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (e) {
    console.warn('[Notifications] Failed to cancel scheduled notification:', e);
  }
}

/**
 * Cancel all scheduled notifications (used when user turns off notifications).
 */
export async function cancelAllNotifications(): Promise<void> {
  if (!Notifications) return;

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch (e) {
    console.warn('[Notifications] Failed to cancel all scheduled notifications:', e);
  }
}

/**
 * Get all currently scheduled notification identifiers.
 */
export async function getScheduledNotifications(): Promise<string[]> {
  if (!Notifications) return [];

  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.map((n: any) => n.identifier);
  } catch (e) {
    console.warn('[Notifications] Failed to get scheduled notifications:', e);
    return [];
  }
}
