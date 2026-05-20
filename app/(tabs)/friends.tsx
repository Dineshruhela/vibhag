/**
 * Friends List Screen
 */
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, DeviceEventEmitter, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { deleteFriend, getAllFriends, type User } from '../../lib/database';

export default function FriendsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [friends, setFriends] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => query.trim()
      ? friends.filter(f =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.email?.toLowerCase().includes(query.toLowerCase()) ||
          f.phone?.includes(query)
        )
      : friends,
    [friends, query]
  );

  const loadFriends = useCallback(async () => {
    try {
      setFriends(await getAllFriends());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadFriends(); }, [loadFriends]));

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('sync_complete', loadFriends);
    return () => sub.remove();
  }, [loadFriends]);

  const handleDelete = (friend: User) => {
    Alert.alert('Remove Friend', `Remove ${friend.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await deleteFriend(friend.id);
          loadFriends();
        },
      },
    ]);
  };

  const handleOptions = (friend: User) => {
    Alert.alert(friend.name, 'Choose an action', [
      { text: 'Edit / Rename', onPress: () => router.push({ pathname: '/friends/add' as any, params: { id: friend.id } }) },
      { text: 'Remove Friend', style: 'destructive', onPress: () => handleDelete(friend) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search friends..."
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
          autoCapitalize="none"
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await require('@/lib/sync').pullFromCloud();
              } catch (e) {
                console.warn('[Friends] Pull to refresh cloud sync failed:', e);
              }
              await loadFriends();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {filtered.length > 0 && (
          <Card variant="default" padding={0}>
            {filtered.map((friend, i) => (
              <Animated.View key={friend.id} entering={FadeInDown.delay(i * 60).springify()}>
                <Pressable
                  onPress={() => handleOptions(friend)}
                  style={[styles.row, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                >
                  <Avatar name={friend.name} color={friend.avatar_color} size={44} />
                  <View style={styles.info}>
                    <Text style={[styles.name, { color: colors.text }]}>{friend.name}</Text>
                    {friend.email && <Text style={[styles.sub, { color: colors.textTertiary }]}>{friend.email}</Text>}
                    {!friend.email && friend.phone && <Text style={[styles.sub, { color: colors.textTertiary }]}>{friend.phone}</Text>}
                  </View>
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.textTertiary} />
                </Pressable>
              </Animated.View>
            ))}
          </Card>
        )}

        {filtered.length === 0 && !loading && (
          <EmptyState
            icon="person-add-outline"
            title="No Friends Yet"
            subtitle="Add friends to start splitting expenses."
            actionLabel="Add Friend"
            onAction={() => router.push('/friends/add')}
          />
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <FAB onPress={() => router.push('/friends/add')} icon="person-add" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  scroll: { padding: Spacing.base },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: 12 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, marginTop: 2 },
});
