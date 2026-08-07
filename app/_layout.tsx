/**
 * Root Layout for Splitmaro
 */
import { ToastProvider } from '@/components/Toast';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useNotifications } from '@/hooks/useNotifications';
import { useSync } from '@/hooks/useSync';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* silencing error/warning when splash screen is not registered or already hidden */
});

const SplitmaroDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.primary,
  },
};

const SplitmaroLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.surface,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.primary,
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const router = useRouter();
  useNotifications();
  useSync();

  // Configure RevenueCat Purchases once the user profile is loaded
  useEffect(() => {
    if (Platform.OS === 'ios') {
      (async () => {
        try {
          const { getCurrentUser } = require('../lib/database');
          const Purchases = require('react-native-purchases').default;
          const user = await getCurrentUser().catch(() => null);
          if (user && user.id) {
            console.log('[Purchases] Initializing RevenueCat for user:', user.id);
            Purchases.configure({
              apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || 'your_revenuecat_api_key',
              appUserID: user.id
            });
          }
        } catch (e) {
          console.warn('[Purchases] Failed to initialize RevenueCat:', e);
        }
      })();
    }
  }, []);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('auth_change', async () => {
      if (Platform.OS === 'ios') {
        try {
          const { getCurrentUser } = require('../lib/database');
          const Purchases = require('react-native-purchases').default;
          const user = await getCurrentUser().catch(() => null);
          if (user && user.id) {
            console.log('[Purchases] Re-configuring RevenueCat for user:', user.id);
            Purchases.configure({
              apiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || 'your_revenuecat_api_key',
              appUserID: user.id
            });
          }
        } catch (e) {
          console.warn('[Purchases] Failed to re-configure RevenueCat:', e);
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Handle deep links (e.g. splitmaro://join/GROUP_ID)
  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      console.log('[DeepLink] Received URL:', event.url);
      const parsed = Linking.parse(event.url);
      
      // Check for splitmaro://pro-success (Android only, iOS has no Pro upgrade)
      if (Platform.OS !== 'ios' && (parsed.hostname === 'pro-success' || event.url.includes('pro-success'))) {
        console.log('[DeepLink] Pro upgrade success detected, dismissing browser and emitting success...');
        WebBrowser.dismissBrowser();
        DeviceEventEmitter.emit('pro_upgrade_success');
        return;
      }

      if (parsed.hostname === 'join' && parsed.path) {
        const groupId = parsed.path.replace(/^\//, '');
        if (groupId) router.push(`/join/${groupId}` as any);
      }

      if (parsed.hostname === 'referral' && parsed.path) {
        const referrerId = parsed.path.replace(/^\//, '');
        if (referrerId) {
          console.log('[DeepLink] Captured referral code from link:', referrerId);
          AsyncStorage.setItem('pending_referral_code', referrerId).catch(err => {
            console.error('[DeepLink] Failed to store referral code:', err);
          });
        }
      }
    };

    // Handle link that opened the app from cold start
    Linking.getInitialURL().then(url => {
      if (url) handleUrl({ url });
    });

    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync().catch(() => {
        /* silencing error/warning when splash screen is not registered or already hidden */
      });
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
      <ThemeProvider value={SplitmaroDarkTheme}>
        <GlobalProgressBar />
        <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="group/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="group/create"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="group/invite"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="group/add-expense"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="group/expense/edit"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="group/settle"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="friends/add"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="join/[groupId]"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="auth/login"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="pro/referrals"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name="group/members"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="group/expense/[id]"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="pro/upgrade"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="admin/dashboard"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
    </ToastProvider>
    </GestureHandlerRootView>
  );
}

function GlobalProgressBar() {
  const [loading, setLoading] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('api_loading_change', (isLoading: boolean) => {
      if (isLoading) {
        setLoading(true);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 150,
            useNativeDriver: false,
          }),
          Animated.timing(progress, {
            toValue: 0.85,
            duration: 1200,
            useNativeDriver: false,
          }),
        ]).start();
      } else {
        Animated.timing(progress, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }).start(() => {
          Animated.timing(opacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            progress.setValue(0);
            setLoading(false);
          });
        });
      }
    });

    return () => sub.remove();
  }, [progress, opacity]);

  if (!loading) return null;

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.progressContainer, { top: insets.top, opacity }]}>
      <Animated.View style={[styles.progressBar, { width }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  progressContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(28, 194, 159, 0.1)',
    zIndex: 99999,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#1CC29F',
  },
});
