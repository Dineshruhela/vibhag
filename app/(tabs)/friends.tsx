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
import { deleteFriend, getAllFriends, getFriendRequests, acceptFriendRequest, declineFriendRequest, type User } from '../../lib/database';

export default function FriendsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<User[]>([]);
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
      const [allFriends, pendingRequests] = await Promise.all([
        getAllFriends(),
        getFriendRequests()
      ]);
      setFriends(allFriends);
      setRequests(pendingRequests);
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
        {requests.length > 0 && (
          <View style={{ marginBottom: Spacing.base }}>
            <Text style={[styles.requestsHeader, { color: colors.primary }]}>FRIEND REQUESTS ({requests.length})</Text>
            <Card variant="default" padding={0}>
              {requests.map((reqUser, i) => (
                <Animated.View key={reqUser.id} entering={FadeInDown.springify()}>
                  <View style={[styles.requestRow, i < requests.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                    <Avatar name={reqUser.name} color={reqUser.avatar_color} size={40} avatarUrl={reqUser.avatar_url} />
                    <View style={styles.info}>
                      <Text style={[styles.name, { color: colors.text }]}>{reqUser.name}</Text>
                      {reqUser.email && <Text style={[styles.sub, { color: colors.textTertiary }]}>{reqUser.email}</Text>}
                      {!reqUser.email && reqUser.phone && <Text style={[styles.sub, { color: colors.textTertiary }]}>{reqUser.phone}</Text>}
                    </View>
                    <View style={styles.requestActions}>
                      <Pressable
                        onPress={async () => {
                          try {
                            await acceptFriendRequest(reqUser.id);
                            loadFriends();
                          } catch (e) {
                            Alert.alert('Error', 'Failed to accept friend request.');
                          }
                        }}
                        style={[styles.acceptBtn, { backgroundColor: colors.primary }]}
                      >
                        <Ionicons name="checkmark" size={14} color="#FFF" />
                        <Text style={styles.acceptBtnText}>Accept</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          try {
                            await declineFriendRequest(reqUser.id);
                            loadFriends();
                          } catch (e) {
                            Alert.alert('Error', 'Failed to decline friend request.');
                          }
                        }}
                        style={[styles.declineBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                      >
                        <Ionicons name="close" size={14} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </Card>
          </View>
        )}

        {filtered.length > 0 && (
          <Card variant="default" padding={0}>
            {filtered.map((friend, i) => (
              <Animated.View key={friend.id} entering={FadeInDown.delay(i * 60).springify()}>
                <Pressable
                  onPress={() => handleOptions(friend)}
                  style={[styles.row, i < filtered.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                >
                  <Avatar name={friend.name} color={friend.avatar_color} size={44} avatarUrl={friend.avatar_url} />
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
  requestsHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
    paddingHorizontal: 4,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: 12,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  acceptBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  declineBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
