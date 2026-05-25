/**
 * Splitmaro Premium Admin Dashboard Screen
 */
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { apiRequest } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type Purchase = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  created_at: number;
  user: {
    name: string;
    email: string;
    avatar_color: string;
  } | null;
};

type Stats = {
  totalUsers: number;
  proUsers: number;
  totalReferrals: number;
  totalRevenue: number;
  purchases: Purchase[];
};

export default function AdminDashboardScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  // Pricing configuration states
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('');
  const [updatingConfig, setUpdatingConfig] = useState(false);

  const fetchStats = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // 1. Fetch system-wide admin metrics and transaction logs
      const data = await apiRequest('/api/admin/stats');
      if (data) {
        setStats(data);
      }

      // 2. Fetch current active configuration
      const config = await apiRequest('/api/payment/config');
      if (config) {
        setPrice(String(config.amount));
        setCurrency(config.currency);
      }
    } catch (e: any) {
      console.error('[AdminDashboard] Failed to fetch admin metrics:', e);
      Alert.alert('Access Denied', e.message || 'Only administrators can access the console.');
      router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats(false);
  };

  const handleSavePricing = async () => {
    const parsedPrice = Number(price);
    if (isNaN(parsedPrice) || parsedPrice < 1) {
      Alert.alert('Invalid Price', 'Price must be a valid number greater than or equal to 1.');
      return;
    }
    const cleanCurrency = currency.trim().toUpperCase();
    if (!cleanCurrency || cleanCurrency.length > 5) {
      Alert.alert('Invalid Currency', 'Currency code must be 1 to 5 characters long.');
      return;
    }

    setUpdatingConfig(true);
    try {
      await apiRequest('/api/admin/config', {
        method: 'POST',
        body: JSON.stringify({ amount: parsedPrice, currency: cleanCurrency }),
      });
      Alert.alert('Pricing Updated', `Splitmaro Pro pricing successfully updated to ${cleanCurrency} ${parsedPrice}!`);
      fetchStats(false);
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Failed to update pricing configurations.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'success':
        return '#2ECC71';
      case 'pending':
        return '#F1C40F';
      case 'failed':
        return '#E74C3C';
      default:
        return colors.textTertiary;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading Admin Dashboard...</Text>
      </View>
    );
  }

  const statItems = [
    { title: 'TOTAL USERS', value: stats?.totalUsers ?? 0, icon: 'people', color: '#3498DB' },
    { title: 'PRO SUBSCRIBERS', value: stats?.proUsers ?? 0, icon: 'diamond', color: '#9B59B6' },
    { title: 'VIRAL REFERRALS', value: stats?.totalReferrals ?? 0, icon: 'gift', color: '#2ECC71' },
    {
      title: 'TOTAL REVENUE',
      value: `${currency === 'INR' ? '₹' : currency} ${Math.round(stats?.totalRevenue ?? 0)}`,
      icon: 'cash',
      color: '#E67E22',
    },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeInUp.springify()} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Admin Console</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      <FlatList
        data={stats?.purchases ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={
          <>
            {/* Grid Stats */}
            <View style={styles.statsGrid}>
              {statItems.map((item, index) => (
                <Animated.View
                  key={index}
                  entering={FadeInDown.delay(100 + index * 50).springify()}
                  style={[styles.statWrapper]}
                >
                  <Card variant="default" style={styles.statCard}>
                    <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                      <Ionicons name={item.icon as any} size={20} color={item.color} />
                    </View>
                    <Text style={[styles.statVal, { color: colors.text }]}>{item.value}</Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{item.title}</Text>
                  </Card>
                </Animated.View>
              ))}
            </View>

            {/* Config Box */}
            <Animated.View entering={FadeInDown.delay(300).springify()} style={styles.sectionMargin}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PRICING CONFIGURATION</Text>
              <Card variant="default" style={styles.configCard}>
                <View style={styles.inputsRow}>
                  <View style={styles.inputCol}>
                    <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>PRO AMOUNT</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="numeric"
                      placeholder="499"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>CURRENCY CODE</Text>
                    <TextInput
                      style={[
                        styles.input,
                        { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      value={currency}
                      onChangeText={setCurrency}
                      autoCapitalize="characters"
                      placeholder="INR"
                      placeholderTextColor={colors.textTertiary}
                    />
                  </View>
                </View>

                <Pressable
                  onPress={handleSavePricing}
                  disabled={updatingConfig}
                  style={({ pressed }) => [
                    styles.updateBtn,
                    {
                      backgroundColor: colors.primary,
                      opacity: (updatingConfig || pressed) ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={styles.updateBtnText}>
                    {updatingConfig ? 'Updating Configurations...' : 'Update System Configuration'}
                  </Text>
                </Pressable>
              </Card>
            </Animated.View>

            {/* Logs Header */}
            <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.sectionMargin}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>TRANSACTION LOGS & HISTORY</Text>
            </Animated.View>
          </>
        }
        renderItem={({ item, index }) => (
          <Animated.View
            entering={FadeInDown.delay(400 + Math.min(index, 5) * 50).springify()}
            style={styles.logCardWrapper}
          >
            <Card variant="default" style={styles.logCard}>
              <View style={styles.logHeader}>
                <Avatar
                  name={item.user?.name || 'Deleted User'}
                  color={item.user?.avatar_color || '#7F8C8D'}
                  size={42}
                  fontSize={16}
                />
                <View style={styles.logUserMeta}>
                  <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                    {item.user?.name || 'Deleted User'}
                  </Text>
                  <Text style={[styles.userEmail, { color: colors.textTertiary }]} numberOfLines={1}>
                    {item.user?.email || 'N/A'}
                  </Text>
                </View>
                <View style={styles.logPriceBlock}>
                  <Text style={[styles.logPriceVal, { color: colors.text }]}>
                    {item.currency === 'INR' ? '₹' : item.currency} {item.amount}
                  </Text>
                  <View style={[styles.badge, { borderColor: getStatusColor(item.status) + '40' }]}>
                    <Text style={[styles.badgeText, { color: getStatusColor(item.status) }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

              <View style={styles.logFooter}>
                <View style={styles.footerCol}>
                  <Text style={[styles.footerLabel, { color: colors.textTertiary }]}>PROVIDER</Text>
                  <Text style={[styles.footerVal, { color: colors.textSecondary }]}>
                    {item.provider.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.footerCol}>
                  <Text style={[styles.footerLabel, { color: colors.textTertiary }]}>TIMESTAMP</Text>
                  <Text style={[styles.footerVal, { color: colors.textSecondary }]}>{formatDate(item.created_at)}</Text>
                </View>
                {item.razorpay_payment_id && (
                  <View style={[styles.footerCol, { flex: 1.5 }]}>
                    <Text style={[styles.footerLabel, { color: colors.textTertiary }]}>PAYMENT ID</Text>
                    <Text style={[styles.footerVal, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.razorpay_payment_id}
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          </Animated.View>
        )}
        ListEmptyComponent={
          <Animated.View entering={FadeInDown.delay(400).springify()} style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No purchases logged yet.</Text>
          </Animated.View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    marginBottom: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  listContainer: { padding: Spacing.base, paddingBottom: 40 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: Spacing.xl },
  statWrapper: { width: '48%' },
  statCard: { padding: 14, gap: 8 },
  iconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  sectionMargin: { marginTop: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  configCard: { padding: Spacing.lg, gap: 16 },
  inputsRow: { flexDirection: 'row', gap: 12 },
  inputCol: { flex: 1, gap: 6 },
  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  input: { padding: Spacing.md, borderRadius: BorderRadius.md, fontSize: 15, borderWidth: 1 },
  updateBtn: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
  updateBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  logCardWrapper: { marginBottom: 12 },
  logCard: { padding: Spacing.base, gap: Spacing.sm },
  logHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logUserMeta: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontWeight: '700' },
  userEmail: { fontSize: 12 },
  logPriceBlock: { alignItems: 'flex-end', gap: 4 },
  logPriceVal: { fontSize: 16, fontWeight: '800' },
  badge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  divider: { height: 1, marginVertical: 4 },
  logFooter: { flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  footerCol: { flex: 1, gap: 2 },
  footerLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  footerVal: { fontSize: 11, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', padding: 40, gap: 12 },
  emptyText: { fontSize: 14, fontWeight: '600' },
});
