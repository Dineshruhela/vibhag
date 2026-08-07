/**
 * Splitmaro Pro Upgrade Screen
 */
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, DeviceEventEmitter, Pressable, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { getCurrentUser, refreshCurrentUser } from '../../lib/database';
import { apiRequest, api } from '../../lib/api';

export default function UpgradeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [price, setPrice] = useState(499);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [loading, setLoading] = useState(false);
  const [rcPackage, setRcPackage] = useState<any>(null);
  const [isPro, setIsPro] = useState(false);

  const refreshProStatus = async () => {
    const updatedUser = await refreshCurrentUser();
    const active = !!updatedUser.is_pro;
    setIsPro(active);
    if (active) DeviceEventEmitter.emit('auth_change');
    return active;
  };

  const hasProEntitlement = (customerInfo: any) => {
    const activeEntitlements = customerInfo?.entitlements?.active || {};
    return Boolean(activeEntitlements.pro || activeEntitlements['splitmaro Pro']);
  };

  React.useEffect(() => {
    refreshProStatus().catch(() => setIsPro(false));
    if (Platform.OS === 'ios') {
      (async () => {
        try {
          const Purchases = require('react-native-purchases').default;
          const offerings = await Purchases.getOfferings();
          if (offerings.current !== null && offerings.current.availablePackages.length !== 0) {
            const proPackage = offerings.current.availablePackages[0];
            setRcPackage(proPackage);
            setPrice(proPackage.product.price);
            setCurrencySymbol(proPackage.product.currencySymbol || '₹');
          }
        } catch (e) {
          console.warn('[UpgradeScreen] Failed to fetch offerings:', e);
        }
      })();
    } else {
      (async () => {
        try {
          const config = await apiRequest('/api/payment/config');
          if (config && config.amount) {
            setPrice(config.amount);
            const symbols: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
            setCurrencySymbol(symbols[config.currency] || config.currency || '₹');
          }
        } catch (err) {
          console.warn('[UpgradeScreen] Failed to fetch payment config:', err);
        }
      })();
    }
  }, []);

  React.useEffect(() => {
    if (Platform.OS !== 'ios') {
      const sub = DeviceEventEmitter.addListener('pro_upgrade_success', async () => {
        console.log('[UpgradeScreen] Received success event from deep link redirect!');
        setLoading(true);
        try {
          Alert.alert('Verifying purchase...', 'Activating Splitmaro Pro 💎');
          const updatedUser = await refreshCurrentUser();
          console.log('[UpgradeScreen] Refreshed user:', updatedUser);
          
          if (updatedUser.is_pro) {
            setIsPro(true);
            DeviceEventEmitter.emit('auth_change');
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
    }
  }, [router]);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'ios') {
        const Purchases = require('react-native-purchases').default;
        if (!rcPackage) {
          throw new Error('Store offerings are not loaded yet. Please try again in a moment.');
        }

        console.log('[UpgradeScreen] Initiating RevenueCat Apple IAP purchase for:', rcPackage.identifier);
        const { customerInfo } = await Purchases.purchasePackage(rcPackage);

        const isEntitled = hasProEntitlement(customerInfo);

        if (isEntitled) {
          console.log('[UpgradeScreen] Purchase verified by RevenueCat! Syncing with backend...');
          const { syncRevenueCatProStatus } = require('../../lib/database');
          // Pass real App Store price so backend records the actual transaction amount
          await syncRevenueCatProStatus({
            amount: rcPackage.product.price,
            currency: rcPackage.product.currencyCode || 'INR',
          });
          setIsPro(true);
          
          DeviceEventEmitter.emit('auth_change');
          Alert.alert('Splitmaro Pro Activated! 💎', 'Enjoy unlimited groups, recurring expenses, budget alerts, and all other premium features.', [
            { text: 'Awesome!', onPress: () => router.back() }
          ]);
        } else {
          throw new Error('Your payment was successful, but the Pro entitlement could not be verified. Please restore your purchase.');
        }
        return;
      }

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
      
      if (result.type === 'cancel') {
        console.log('[UpgradeScreen] WebBrowser closed manually by user, checking status...');
        try {
          if (await refreshProStatus()) {
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
      if (!e.userCancelled) {
        Alert.alert('Payment Error', e.message || 'Failed to initiate payment. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'ios') {
        const Purchases = require('react-native-purchases').default;
        const customerInfo = await Purchases.restorePurchases();
        if (!hasProEntitlement(customerInfo)) {
          throw new Error('No active Splitmaro Pro purchase was found for this Apple ID.');
        }
        const { syncRevenueCatProStatus } = require('../../lib/database');
        await syncRevenueCatProStatus();
        setIsPro(true);
        DeviceEventEmitter.emit('auth_change');
        Alert.alert('Purchase Restored', 'Pro is active and ads have been removed.');
      } else if (await refreshProStatus()) {
        Alert.alert('Pro Active', 'Your verified payment is active and ads have been removed.');
      } else {
        Alert.alert('No Purchase Found', 'We could not find a verified Pro payment for this account yet.');
      }
    } catch (e: any) {
      Alert.alert('Restore Failed', e.message || 'Could not restore your purchase.');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: 'star', title: 'Ad-Free Experience', desc: 'Remove all ads and enjoy a seamless experience.' },
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
          {isPro && (
            <View style={[styles.activeBadge, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
              <Text style={[styles.activeBadgeText, { color: colors.primary }]}>Pro active · Ads removed</Text>
            </View>
          )}
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
            onPress={isPro ? handleRestore : handleUpgrade}
            disabled={loading}
            style={[styles.upgradeBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
          >
            {loading ? (
              <Text style={styles.btnText}>Processing...</Text>
            ) : (
              <Text style={styles.btnText}>
                {isPro ? 'Check Pro Status' : `Upgrade Now — ${currencySymbol}${price}`}
              </Text>
            )}
          </Pressable>
          <Pressable onPress={handleRestore} disabled={loading} style={styles.restoreBtn}>
            <Text style={[styles.restoreText, { color: colors.primary }]}>Restore / verify purchase</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
        <View style={styles.priceContainer}>
          <Text style={[styles.priceLabel, { color: colors.textTertiary }]}>
            ONE-TIME PAYMENT
          </Text>
          <Text style={[styles.price, { color: colors.text }]}>
            {`${currencySymbol}${price}`}
          </Text>
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
  activeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, marginTop: 16 },
  activeBadgeText: { fontSize: 13, fontWeight: '700' },
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
  restoreBtn: { alignItems: 'center', paddingVertical: 14 },
  restoreText: { fontSize: 14, fontWeight: '600' },
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
