/**
 * Toast Component
 * Replaces Alert.alert for non-critical feedback
 * Usage: ToastService.show({ message: 'Saved!', type: 'success' })
 */
import { BorderRadius, Elevation, Spacing } from '@/constants/Spacing';
import { FontFamily, Typography } from '@/constants/Typography';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeInDown,
    FadeOutUp
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
};

type ToastContextType = {
  show: (opts: Omit<ToastItem, 'id'>) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

const TYPE_CONFIG: Record<
  ToastType,
  { bg: string; icon: string; textColor: string }
> = {
  success: { bg: '#10B981', icon: 'checkmark-circle', textColor: '#FFFFFF' },
  error: { bg: '#EF4444', icon: 'close-circle', textColor: '#FFFFFF' },
  warning: { bg: '#F59E0B', icon: 'warning', textColor: '#FFFFFF' },
  info: { bg: '#3B82F6', icon: 'information-circle', textColor: '#FFFFFF' },
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const insets = useSafeAreaInsets();
  const cfg = TYPE_CONFIG[item.type];

  React.useEffect(() => {
    const timer = setTimeout(onDismiss, item.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [item.id]);

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20).stiffness(300)}
      exiting={FadeOutUp.duration(200)}
      style={[
        styles.toast,
        { backgroundColor: cfg.bg, marginTop: insets.top + Spacing.sm },
      ]}
    >
      <Ionicons name={cfg.icon as any} size={20} color={cfg.textColor} />
      <Text style={[styles.message, { color: cfg.textColor }]} numberOfLines={2}>
        {item.message}
      </Text>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <Ionicons name="close" size={16} color={cfg.textColor} style={{ opacity: 0.7 }} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((opts: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-2), { ...opts, id }]);
    if (opts.type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (opts.type === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (opts.type === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextType = {
    show,
    success: (message) => show({ message, type: 'success' }),
    error: (message) => show({ message, type: 'error' }),
    warning: (message) => show({ message, type: 'warning' }),
    info: (message) => show({ message, type: 'info' }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 9999,
    gap: Spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    ...Elevation.lg,
    shadowColor: '#000',
  },
  message: {
    flex: 1,
    fontSize: Typography.size.sm,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    lineHeight: 18,
  },
});
