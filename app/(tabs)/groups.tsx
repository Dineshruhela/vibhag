/**
 * Groups List Screen
 */
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { Skeleton } from '@/components/Skeleton';
import { GroupCategoryColors } from '@/constants/Colors';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { formatCurrency, formatRelativeTime } from '@/lib/format';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, DeviceEventEmitter, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getAllGroups, getGroupBalancesForCurrentUser, type Group } from '../../lib/database';
import { pullFromCloud } from '../../lib/sync';

export default function GroupsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => query.trim() ? groups.filter(g => g.name.toLowerCase().includes(query.toLowerCase())) : groups,
    [groups, query]
  );

  const loadGroups = useCallback(async () => {
    try {
      const [data, bal] = await Promise.all([getAllGroups(), getGroupBalancesForCurrentUser()]);
      setGroups(data);
      setBalances(bal);
    } catch (e) {
      setGroups([]);
      setBalances({});
      Alert.alert('No User Found', 'No user exists in the app. Please sign in or create an account.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('sync_complete', loadGroups);
    return () => sub.remove();
  }, [loadGroups]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await pullFromCloud();
    } catch (e) {
      console.warn('[Groups] Pull to refresh cloud sync failed:', e);
    }
    await loadGroups();
    setRefreshing(false);
  }, [loadGroups]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search groups..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
          autoCapitalize="none"
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ gap: Spacing.sm }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} height={76} borderRadius={BorderRadius.xl} />
            ))}
          </View>
        ) : (
          <>
            {filtered.map((group, index) => {
          const cat = GroupCategoryColors[group.category] || GroupCategoryColors.other;
          return (
            <Animated.View key={group.id} entering={FadeInDown.delay(index * 80).springify()}>
              <Card
                onPress={() => router.push(`/group/${group.id}`)}
                variant="default"
                style={styles.groupCard}
              >
                <View style={styles.groupRow}>
                  <View style={[styles.emojiBox, { backgroundColor: cat.color + '20' }]}>
                    <Text style={styles.emoji}>{cat.emoji}</Text>
                  </View>
                  <View style={styles.groupInfo}>
                    <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>
                      {group.name}
                    </Text>
                    <View style={styles.groupMeta}>
                      <View style={styles.memberBadge}>
                        <Ionicons name="people-outline" size={12} color={colors.textTertiary} />
                        <Text style={[styles.memberCount, { color: colors.textTertiary }]}>
                          {group.member_count}
                        </Text>
                      </View>
                      <Text style={[styles.dot, { color: colors.textTertiary }]}>·</Text>
                      <Text style={[styles.timeAgo, { color: colors.textTertiary }]}>
                        {formatRelativeTime(group.updated_at)}
                      </Text>
                    </View>
                  </View>
                  {(() => {
                    const bal = balances[group.id];
                    if (!bal || Math.abs(bal) < 0.01) return <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />;
                    const isOwed = bal > 0;
                    const balColor = isOwed ? '#1CC29F' : '#FF6B6B';
                    return (
                      <View style={styles.balanceChip}>
                        <Text style={[styles.balanceLabel, { color: balColor }]}>
                          {isOwed ? 'you get' : 'you owe'}
                        </Text>
                        <Text style={[styles.balanceAmt, { color: balColor }]}>
                          {formatCurrency(Math.abs(bal))}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
              </Card>
            </Animated.View>
          );
        })}
          </>
        )}

        {filtered.length === 0 && !loading && (
          <EmptyState
            icon="people-outline"
            title="No Groups Yet"
            subtitle="Create a group to start splitting expenses with friends, family, or roommates."
            actionLabel="Create Group"
            onAction={() => router.push('/group/create')}
          />
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <FAB
        onPress={() => router.push('/group/create')}
        icon="add"
        color={colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.base,
    marginTop: Spacing.base,
    marginBottom: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 2,
  },
  scrollContent: {
    padding: Spacing.base,
  },
  groupCard: {
    marginBottom: Spacing.sm,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emojiBox: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 26,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  memberCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  dot: {
    fontSize: 12,
  },
  timeAgo: {
    fontSize: 12,
  },
  balanceChip: {
    alignItems: 'flex-end',
  },
  balanceLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceAmt: {
    fontSize: 13,
    fontWeight: '700',
  },
});
