/**
 * Dashboard Screen - Main overview of balances
 */
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/lib/format';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    DeviceEventEmitter,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/api';
type Balance = { userId: string; userName: string; avatarColor: string; amount: number };
type Group = { id: string; name: string; category?: string; cover_image?: string; member_count: number };
type User = { id: string; name: string; avatar_color: string };

export default function DashboardScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [totalOwed, setTotalOwed] = useState(0);
  const [totalOwe, setTotalOwe] = useState(0);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      // Pull from API only
      const response = await api.pull(0); // Always get all data from server
      const { users, groups, expenses, balancesByUser } = response.data || {};
      // Find current user from token (if available)
      const token = await api.getToken();
      let cu = null;
      if (token) {
        try {
          const payloadBase64 = token.split('.')[1];
          const payload = JSON.parse(typeof atob !== 'undefined' ? atob(payloadBase64) : Buffer.from(payloadBase64, 'base64').toString('utf-8'));
          cu = users?.find((u: any) => u.id === payload.userId) || null;
        } catch {}
      }
      if (!cu) throw new Error('No user found');
      setCurrentUser(cu);
      setGroups(groups || []);
      // Calculate balances from API data if available
      if (balancesByUser) {
        setBalances(balancesByUser);
        setTotalOwed(balancesByUser.reduce((sum: number, b: any) => sum + (b.amount > 0 ? b.amount : 0), 0));
        setTotalOwe(balancesByUser.reduce((sum: number, b: any) => sum + (b.amount < 0 ? Math.abs(b.amount) : 0), 0));
      } else {
        setBalances([]);
        setTotalOwed(0);
        setTotalOwe(0);
      }
    } catch (e) {
      setCurrentUser(null);
      Alert.alert('No User Found', 'No user exists in the app. Please sign in or create an account.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('sync_complete', loadData);
    return () => sub.remove();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await require('@/lib/sync').pullFromCloud();
    } catch (e) {
      console.warn('[Dashboard] Pull to refresh cloud sync failed:', e);
    }
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const netBalance = totalOwed - totalOwe;
  const hasData = balances.length > 0 || groups.length > 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Redirect to login/signup if not logged in
  React.useEffect(() => {
    if (!loading && !currentUser) {
      router.replace('/auth/login');
    }
  }, [loading, currentUser, router]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>
            {getGreeting()} 👋
          </Text>
          <Text style={[styles.appTitle, { color: colors.text }]}> 
            {currentUser?.name === 'You' ? 'Splitmaro' : currentUser?.name || 'Splitmaro'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/profile' as any)}
          style={[styles.profileBtn, { backgroundColor: colors.surface }]}
        >
          <Avatar
            name={currentUser?.name || 'Y'}
            color={currentUser?.avatar_color || colors.primary}
            size={38}
            fontSize={14}
          />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: Spacing.xl }}>
            <Skeleton height={200} borderRadius={BorderRadius['2xl']} />
            <View>
              <Skeleton width={120} height={20} style={{ marginBottom: 12, marginLeft: 4 }} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Skeleton width={120} height={140} borderRadius={BorderRadius.xl} />
                <Skeleton width={120} height={140} borderRadius={BorderRadius.xl} />
                <Skeleton width={120} height={140} borderRadius={BorderRadius.xl} />
              </View>
            </View>
            <View>
              <Skeleton width={120} height={20} style={{ marginBottom: 12, marginLeft: 4 }} />
              <Skeleton height={80} borderRadius={BorderRadius.xl} style={{ marginBottom: 8 }} />
              <Skeleton height={80} borderRadius={BorderRadius.xl} />
            </View>
          </View>
        ) : (
          <>
            {/* Balance Summary Card */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <LinearGradient
            colors={
              netBalance > 0
                ? ['#1CC29F', '#15967B']
                : netBalance < 0
                ? ['#FF6B6B', '#E05555']
                : [colors.surface, colors.surface]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <Text
              style={[
                styles.balanceTitle,
                { color: netBalance === 0 ? colors.textSecondary : 'rgba(255,255,255,0.85)' },
              ]}
            >
              Overall Balance
            </Text>
            <Text
              style={[
                styles.balanceAmount,
                { color: netBalance === 0 ? colors.textTertiary : '#FFFFFF' },
              ]}
            >
              {netBalance === 0
                ? 'All settled up! 🎉'
                : `${netBalance > 0 ? '+' : ''}${formatCurrency(netBalance)}`}
            </Text>
            {netBalance !== 0 && (
              <Text style={styles.balanceSubtext}>
                {netBalance > 0 ? 'People owe you overall' : 'You owe overall'}
              </Text>
            )}

            <View
              style={[
                styles.balanceRow,
                {
                  borderTopColor:
                    netBalance === 0 ? colors.border : 'rgba(255,255,255,0.2)',
                  borderTopWidth: 1,
                  marginTop: 16,
                },
              ]}
            >
              <View style={styles.balanceItem}>
                <View style={[styles.balanceDot, { backgroundColor: netBalance === 0 ? colors.primary : 'rgba(255,255,255,0.6)' }]} />
                <Text
                  style={[
                    styles.balanceItemLabel,
                    { color: netBalance === 0 ? colors.textSecondary : 'rgba(255,255,255,0.75)' },
                  ]}
                >
                  You are owed
                </Text>
                <Text
                  style={[
                    styles.balanceItemAmount,
                    { color: netBalance === 0 ? colors.primary : '#FFFFFF' },
                  ]}
                >
                  {formatCurrency(totalOwed)}
                </Text>
              </View>
              <View
                style={[
                  styles.divider,
                  { backgroundColor: netBalance === 0 ? colors.border : 'rgba(255,255,255,0.2)' },
                ]}
              />
              <View style={styles.balanceItem}>
                <View style={[styles.balanceDot, { backgroundColor: netBalance === 0 ? colors.negative : 'rgba(255,255,255,0.6)' }]} />
                <Text
                  style={[
                    styles.balanceItemLabel,
                    { color: netBalance === 0 ? colors.textSecondary : 'rgba(255,255,255,0.75)' },
                  ]}
                >
                  You owe
                </Text>
                <Text
                  style={[
                    styles.balanceItemAmount,
                    { color: netBalance === 0 ? colors.negative : '#FFFFFF' },
                  ]}
                >
                  {formatCurrency(totalOwe)}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <View style={styles.quickActions}>
            <Pressable
              style={[styles.quickAction, { backgroundColor: colors.primary + '15' }]}
              onPress={() => router.push('/group/create')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.primary }]}>
                <Ionicons name="people" size={20} color="#FFF" />
              </View>
              <Text style={[styles.quickActionText, { color: colors.text }]}>New Group</Text>
            </Pressable>

            <Pressable
              style={[styles.quickAction, { backgroundColor: '#5C6BC0' + '15' }]}
              onPress={() => router.push('/friends/add')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: '#5C6BC0' }]}>
                <Ionicons name="person-add" size={20} color="#FFF" />
              </View>
              <Text style={[styles.quickActionText, { color: colors.text }]}>Add Friend</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Per-Person Balances */}
        {balances.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Friend Balances</Text>
              <Pressable onPress={() => router.push('/friends')}>
                <Text style={[styles.sectionLink, { color: colors.primary }]}>See all</Text>
              </Pressable>
            </View>
            <Card variant="default" padding={0}>
              {balances.slice(0, 5).map((balance, index) => (
                <View
                  key={balance.userId}
                  style={[
                    styles.balancePersonRow,
                    index < Math.min(balances.length, 5) - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: colors.borderLight,
                    },
                  ]}
                >
                  <Avatar name={balance.userName} color={balance.avatarColor} size={42} fontSize={14} />
                  <View style={styles.balancePersonInfo}>
                    <Text style={[styles.balancePersonName, { color: colors.text }]}>
                      {balance.userName}
                    </Text>
                    <Text
                      style={[
                        styles.balancePersonHint,
                        { color: balance.amount > 0 ? colors.primary : colors.negative },
                      ]}
                    >
                      {balance.amount > 0 ? '↑ owes you' : '↓ you owe'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.balanceBadge,
                      { backgroundColor: balance.amount > 0 ? colors.primary + '15' : colors.negative + '15' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.balancePersonAmount,
                        { color: balance.amount > 0 ? colors.primary : colors.negative },
                      ]}
                    >
                      {formatCurrency(Math.abs(balance.amount))}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </Animated.View>
        )}

        {/* Recent Groups */}
        {groups.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).springify()}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Groups</Text>
              <Pressable onPress={() => router.push('/groups')}>
                <Text style={[styles.sectionLink, { color: colors.primary }]}>See all</Text>
              </Pressable>
            </View>
            {groups.slice(0, 4).map((group, index) => {
              const cat =
                group.category === 'trip'
                  ? '✈️'
                  : group.category === 'home'
                  ? '🏠'
                  : group.category === 'couple'
                  ? '❤️'
                  : group.category === 'work'
                  ? '💼'
                  : '👥';
              const catColor =
                group.category === 'trip'
                  ? '#1ABC9C'
                  : group.category === 'home'
                  ? '#E74C3C'
                  : group.category === 'couple'
                  ? '#FF69B4'
                  : group.category === 'work'
                  ? '#F39C12'
                  : '#3498DB';
              return (
                <Animated.View key={group.id} entering={FadeInDown.delay(400 + index * 60).springify()}>
                  <Card
                    onPress={() => router.push(`/group/${group.id}`)}
                    variant="default"
                    style={styles.groupCard}
                  >
                    <View style={styles.groupRow}>
                      <View style={[styles.groupEmoji, { backgroundColor: catColor + '20' }]}>
                        <Text style={styles.groupEmojiText}>{cat}</Text>
                      </View>
                      <View style={styles.groupInfo}>
                        <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
                        <Text style={[styles.groupMeta, { color: colors.textTertiary }]}>
                          {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </View>
                  </Card>
                </Animated.View>
              );
            })}
          </Animated.View>
        )}

        {!hasData && !loading && (
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <EmptyState
              icon="wallet-outline"
              title="Welcome to Splitmaro!"
              subtitle="Start by creating a group and adding expenses to split with friends."
              actionLabel="Create a Group"
              onAction={() => router.push('/group/create')}
            />
          </Animated.View>
        )}

        <View style={{ height: 100 }} />
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  appTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  profileBtn: {
    borderRadius: 22,
    overflow: 'hidden',
    padding: 2,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
  balanceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  balanceTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  balanceAmount: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
  },
  balanceSubtext: {
    fontSize: 13,
    marginTop: 4,
    color: 'rgba(255,255,255,0.75)',
  },
  balanceRow: {
    flexDirection: 'row',
    paddingTop: Spacing.base,
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  divider: {
    width: 1,
    height: '100%',
  },
  balanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  balanceItemLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  balanceItemAmount: {
    fontSize: 17,
    fontWeight: '800',
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  quickActionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionText: { fontSize: 14, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  sectionLink: { fontSize: 13, fontWeight: '600' },
  balancePersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.md,
  },
  balancePersonInfo: { flex: 1 },
  balancePersonName: { fontSize: 15, fontWeight: '600' },
  balancePersonHint: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  balanceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.lg,
  },
  balancePersonAmount: { fontSize: 14, fontWeight: '800' },
  groupCard: { marginBottom: Spacing.sm },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  groupEmoji: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupEmojiText: { fontSize: 24 },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 15, fontWeight: '700' },
  groupMeta: { fontSize: 12, marginTop: 2 },
});
