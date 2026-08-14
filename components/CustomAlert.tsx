/**
 * CustomAlert Component & Provider — Pro Style
 * Modern, beautiful, premium modal alert replacement with ultra-slick spring physics
 */
import { Spring, Timing } from '@/constants/Motion';
import { BorderRadius, Elevation, Spacing } from '@/constants/Spacing';
import { FontFamily, Typography } from '@/constants/Typography';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

export type AlertButton = {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertType = 'default' | 'danger' | 'warning' | 'success' | 'info';

export type AlertOptions = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: AlertType;
  icon?: keyof typeof Ionicons.glyphMap;
};

type AlertContextType = {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
};

const AlertContext = createContext<AlertContextType | null>(null);

let globalShowAlert: ((options: AlertOptions) => void) | null = null;

export function showModernAlert(options: AlertOptions) {
  if (globalShowAlert) {
    globalShowAlert(options);
  } else {
    console.warn('[CustomAlert] AlertProvider is not mounted yet.');
  }
}

/**
 * Drop-in replacement for standard Alert.alert(title, message, buttons)
 */
export function modernAlert(
  title: string,
  message?: string,
  buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
  options?: { type?: AlertType }
) {
  let inferredType: AlertType = options?.type || 'default';
  const hasDestructive = buttons?.some((b) => b.style === 'destructive');
  const titleLower = title.toLowerCase();

  if (hasDestructive || titleLower.includes('delete') || titleLower.includes('remove') || titleLower.includes('deactivate') || titleLower.includes('sign out') || titleLower.includes('logout')) {
    inferredType = 'danger';
  } else if (titleLower.includes('error') || titleLower.includes('failed')) {
    inferredType = 'danger';
  } else if (titleLower.includes('warning') || titleLower.includes('invalid') || titleLower.includes('required')) {
    inferredType = 'warning';
  } else if (titleLower.includes('success') || titleLower.includes('refreshed') || titleLower.includes('saved')) {
    inferredType = 'success';
  }

  showModernAlert({
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
    type: inferredType,
  });
}

const TYPE_STYLES: Record<
  AlertType,
  { icon: keyof typeof Ionicons.glyphMap; color: string; bgLight: string; glow: string }
> = {
  default: { icon: 'sparkles', color: '#7C5CFC', bgLight: 'rgba(124, 92, 252, 0.16)', glow: 'rgba(124, 92, 252, 0.35)' },
  info: { icon: 'information-circle', color: '#3B82F6', bgLight: 'rgba(59, 130, 246, 0.16)', glow: 'rgba(59, 130, 246, 0.35)' },
  success: { icon: 'checkmark-circle', color: '#10B981', bgLight: 'rgba(16, 185, 129, 0.16)', glow: 'rgba(16, 185, 129, 0.35)' },
  warning: { icon: 'warning', color: '#F59E0B', bgLight: 'rgba(245, 158, 11, 0.16)', glow: 'rgba(245, 158, 11, 0.35)' },
  danger: { icon: 'alert-circle', color: '#EF4444', bgLight: 'rgba(239, 68, 68, 0.16)', glow: 'rgba(239, 68, 68, 0.35)' },
};

function ProAlertButton({
  btn,
  isHalf,
  onPress,
  colors,
}: {
  btn: AlertButton;
  isHalf: boolean;
  onPress: () => Promise<void>;
  colors: any;
}) {
  const scale = useSharedValue(1);
  const isCancel = btn.style === 'cancel';
  const isDestructive = btn.style === 'destructive';
  const isPrimary = !isCancel && !isDestructive;

  let btnBg = isDestructive
    ? '#EF4444'
    : isPrimary
    ? colors.primary
    : colors.surface2 || 'rgba(150, 150, 150, 0.12)';
  let textColor = isDestructive || isPrimary ? '#FFFFFF' : colors.text;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      style={[isHalf ? styles.buttonHalf : styles.buttonFull]}
      onPressIn={() => {
        scale.value = withSpring(0.95, Spring.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, Spring.snappy);
      }}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: btnBg,
            borderWidth: isCancel ? 1 : 0,
            borderColor: isCancel ? colors.border : 'transparent',
          },
          animStyle,
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            {
              color: textColor,
              fontFamily: isPrimary || isDestructive ? FontFamily.bold : FontFamily.medium,
            },
          ]}
        >
          {btn.text}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertConfig, setAlertConfig] = useState<AlertOptions | null>(null);
  const colors = useThemeColors();

  const hideAlert = useCallback(() => {
    setAlertConfig(null);
  }, []);

  const showAlert = useCallback((options: AlertOptions) => {
    const alertType = options.type || 'default';
    if (alertType === 'danger') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else if (alertType === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (alertType === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setAlertConfig(options);
  }, []);

  globalShowAlert = showAlert;

  const currentType = alertConfig?.type || 'default';
  const typeStyle = TYPE_STYLES[currentType];
  const iconName = alertConfig?.icon || typeStyle.icon;

  const buttons = alertConfig?.buttons && alertConfig.buttons.length > 0
    ? alertConfig.buttons
    : [{ text: 'OK', style: 'default' as const }];

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      {alertConfig && (
        <Modal
          transparent
          visible={!!alertConfig}
          animationType="none"
          onRequestClose={hideAlert}
          statusBarTranslucent
        >
          <Animated.View
            entering={FadeIn.duration(Timing.fast)}
            exiting={FadeOut.duration(Timing.fast)}
            style={styles.backdrop}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={hideAlert} />
            <Animated.View
              entering={ZoomIn.springify()
                .damping(Spring.modal.damping)
                .stiffness(Spring.modal.stiffness)
                .mass(Spring.modal.mass)}
              exiting={ZoomOut.duration(Timing.fast)}
              style={[
                styles.dialogCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* Icon Container with glowing aura & pop animation */}
              <Animated.View
                entering={ZoomIn.delay(50)
                  .springify()
                  .damping(Spring.bouncy.damping)
                  .stiffness(Spring.bouncy.stiffness)
                  .mass(Spring.bouncy.mass)}
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor: typeStyle.bgLight,
                    shadowColor: typeStyle.color,
                  },
                ]}
              >
                <Ionicons name={iconName} size={32} color={typeStyle.color} />
              </Animated.View>

              {/* Title & Message */}
              <Text style={[styles.title, { color: colors.text }]}>
                {alertConfig.title}
              </Text>
              {alertConfig.message ? (
                <Text style={[styles.message, { color: colors.textSecondary }]}>
                  {alertConfig.message}
                </Text>
              ) : null}

              {/* Action Buttons */}
              <View style={[styles.buttonContainer, buttons.length === 2 ? styles.buttonRow : styles.buttonColumn]}>
                {buttons.map((btn, index) => (
                  <ProAlertButton
                    key={index}
                    btn={btn}
                    isHalf={buttons.length === 2}
                    colors={colors}
                    onPress={async () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      hideAlert();
                      if (btn.onPress) {
                        await btn.onPress();
                      }
                    }}
                  />
                ))}
              </View>
            </Animated.View>
          </Animated.View>
        </Modal>
      )}
    </AlertContext.Provider>
  );
}

export function useAlert(): AlertContextType {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    zIndex: 99999,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    ...Elevation.xl,
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: Typography.size.lg,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.xs,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: Typography.size.sm,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  buttonContainer: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  buttonColumn: {
    flexDirection: 'column',
  },
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonHalf: {
    flex: 1,
  },
  buttonFull: {
    width: '100%',
  },
  buttonText: {
    fontSize: Typography.size.sm,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
});
