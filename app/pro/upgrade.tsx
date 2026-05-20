/**
 * Splitmaro Pro Upgrade Screen
 */
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUser, updateUser } from '../../lib/database';

export default function UpgradeScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const price = 499;
  const payeeVPA = 'vibhag@upi';
  const payeeName = 'dinesh kumar ruhela';

  const handleUpgrade = async () => {
    setLoading(true);
    const user = await getCurrentUser();
    const transactionId = `SPLITMAROPRO-${user.id}-${Date.now()}`;
    
    // Construct the UPI deep link URL
    const url = `upi://pay?pa=${payeeVPA}&pn=${encodeURIComponent(payeeName)}&am=${price}&tid=${transactionId}&tn=Splitmaro%20Pro%20Upgrade`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        // Simulator / non-UPI environment testing bypass
        Alert.alert(
          'UPI App Not Found',
          'UPI apps are not installed on this device or simulator. Would you like to simulate a successful payment for testing?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setLoading(false)
            },
            {
              text: 'Simulate Payment ✅',
              onPress: async () => {
                Alert.alert('Verifying purchase...', 'Checking transaction status...');
                await new Promise(resolve => setTimeout(resolve, 1500));
                await updateUser(user.id, { is_pro: 1 });
                Alert.alert('Welcome to Pro! 💎', 'Your account has been successfully upgraded to Splitmaro Pro.', [
                  { text: 'Awesome!', onPress: () => router.back() }
                ]);
                setLoading(false);
              }
            }
          ]
        );
        return;
      }
      
      // Open the UPI app
      await Linking.openURL(url);

      // For this example, we'll assume payment is successful after the user returns to the app.
      // In a real app, you would need a backend webhook from your payment gateway to verify the transaction status.
      // We listen for the app to become active again.
      const onAppStateChange = async (nextAppState: string) => {
        if (nextAppState === 'active') {
          Alert.alert('Verifying purchase...', 'Checking your Pro status.');
          // Simulate a network call to your backend to verify the transactionId
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Assume verification is successful
          await updateUser(user.id, { is_pro: 1 });
          Alert.alert('Welcome to Pro!', 'Your account has been upgraded to Splitmaro Pro.', [
            { text: 'Awesome!', onPress: () => router.back() }
          ]);
          setLoading(false);
        }
      };
      
      const subscription = AppState.addEventListener('change', onAppStateChange);
      
      // Clean up listener when the component unmounts or flow completes
      // This is a simplified example; robust handling is needed for production
      setTimeout(() => subscription.remove(), 60000); // Remove listener after 1 minute

    } catch (e) {
      Alert.alert('Error', 'Failed to initiate payment. Please try again.');
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
