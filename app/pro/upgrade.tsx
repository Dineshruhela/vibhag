/**
 * Splitmaro Pro Upgrade Screen
 */
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, DeviceEventEmitter, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { getCurrentUser, refreshCurrentUser } from '../../lib/database';
import { apiRequest, api } from '../../lib/api';

export default function UpgradeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const price = 499;

  React.useEffect(() => {
    // Listen for custom deep link event broadcast from root layout
    const sub = DeviceEventEmitter.addListener('pro_upgrade_success', async () => {
      console.log('[UpgradeScreen] Received success event from deep link redirect!');
      setLoading(true);
      try {
        Alert.alert('Verifying purchase...', 'Activating Splitmaro Pro 💎');
        // Force refresh current user profile from backend
        const updatedUser = await refreshCurrentUser();
        console.log('[UpgradeScreen] Refreshed user:', updatedUser);
        
        if (updatedUser.is_pro) {
          Alert.alert('Welcome to Pro! 💎', 'Your account has been successfully upgraded to Splitmaro Pro.', [
            { text: 'Awesome!', onPress: () => router.back() }
          ]);
        } else {
          Alert.alert('Activation Pending', 'We are still processing your payment. Please wait a moment.');
        }
      } catch (e: any) {
        console.error('[UpgradeScreen] Failed to verify payment:', e);
        Alert.alert('Verification Error', 'Failed to refresh Pro upgrade status. Please try restarting the app.');
      } finally {
        setLoading(false);
      }
    });

    return () => sub.remove();
  }, [router]);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      console.log('[UpgradeScreen] Fetching token for checkout...');
      const token = await api.getToken();
      if (!token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      let rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      if (rawApiUrl.startsWith('"') && rawApiUrl.endsWith('"')) {
        rawApiUrl = rawApiUrl.slice(1, -1);
      }

      const checkoutUrl = `${rawApiUrl}/api/payment/checkout?token=${encodeURIComponent(token)}`;
      console.log('[UpgradeScreen] Opening checkout URL:', checkoutUrl);
      const result = await WebBrowser.openBrowserAsync(checkoutUrl);
      
      // If the user closed the browser manually, let's refresh status just in case they actually paid
      if (result.type === 'cancel') {
        console.log('[UpgradeScreen] WebBrowser closed manually by user, checking status...');
        try {
          const user = await refreshCurrentUser();
          if (user.is_pro) {
            Alert.alert('Welcome to Pro! 💎', 'Your account has been successfully upgraded to Splitmaro Pro.', [
              { text: 'Awesome!', onPress: () => router.back() }
            ]);
            return;
          }
        } catch (e) {
          console.warn('[UpgradeScreen] Error checking status after manual close:', e);
        }
      }
    } catch (e: any) {
      console.error('[UpgradeScreen] Upgrade failed:', e);
      Alert.alert('Payment Error', e.message || 'Failed to initiate payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: 'people', title: 'Unlimited Groups', desc: 'Create as many groups as you need without limits.' },
    { icon: 'repeat', title: 'Recurring Expenses', desc: 'Auto-generate weekly, monthly, or yearly bills like rent and subscriptions.' },
    { icon: 'flash', title: 'Smart UPI Payments', desc: 'Settle debts instantly with integrated UPI deep linking.' },
    { icon: 'document-text', title: 'Detailed CSV Export', desc: 'Export full expense reports for any group.' },
    { icon: 'cloud-done', title: 'Cloud Sync', desc: 'Access your data across all your devices.' },
    { icon: 'wallet', title: 'Monthly Budget Alerts', desc: 'Set a spending limit and get alerts when you approach it.' },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.hero}>
          <View style={[styles.diamondIcon, { backgroundColor: colors.primary }]}>
            <Ionicons name="diamond-outline" size={40} color="#FFF" />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Splitmaro Pro</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Level up your expense management with premium features.
          </Text>
        </Animated.View>

        <View style={styles.featuresList}>
          {features.map((f, i) => (
            <Animated.View 
              key={i} 
              entering={FadeInDown.delay(200 + i * 100).springify()} 
              style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.featureIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name={f.icon as any} size={22} color={colors.primary} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.textTertiary }]}>{f.desc}</Text>
              </View>
            </Animated.View>
          ))}
        </View>

        <View style={{ height: 40 }} />

        <Animated.View entering={FadeInDown.delay(800).springify()}>
          <Pressable 
            onPress={handleUpgrade} 
            disabled={loading}
            style={[styles.upgradeBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          >
            {loading ? (
              <Text style={styles.btnText}>Processing...</Text>
            ) : (
              <Text style={styles.btnText}>Upgrade Now for ₹{price}</Text>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
        <View style={styles.priceContainer}>
          <Text style={[styles.priceLabel, { color: colors.textTertiary }]}>ONE-TIME PAYMENT</Text>
          <Text style={[styles.price, { color: colors.text }]}>₹499</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: Spacing.xl },
  hero: { alignItems: 'center', marginBottom: 40 },
  diamondIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg, transform: [{ rotate: '45deg' }] },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 12 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  featuresList: { gap: 16 },
  featureCard: { flexDirection: 'row', padding: 16, borderRadius: BorderRadius.lg, borderWidth: 1, gap: 16, alignItems: 'center' },
  featureIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  featureDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  upgradeBtn: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    marginHorizontal: Spacing.base,
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: { padding: Spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 20, borderTopWidth: 1 },
  priceContainer: { flex: 1 },
  priceLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  price: { fontSize: 24, fontWeight: '800' },
});
