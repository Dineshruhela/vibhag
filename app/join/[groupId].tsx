/**
 * Group Invite Deep Link Landing Screen
 * Opened when user taps a splitmaro://join/GROUP_ID link
 */
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator, Alert,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addGroupMember, getCurrentUser, getGroup, getGroupMembers, type Group } from '../../lib/database';

const CATEGORY_EMOJI: Record<string, string> = {
  trip: '✈️', home: '🏠', couple: '❤️', work: '💼', other: '👥',
};

export default function JoinGroupScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const colors = useThemeColors();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const loadGroup = useCallback(async () => {
    if (!groupId) { setNotFound(true); setLoading(false); return; }
    try {
      const [g, currentUser] = await Promise.all([
        getGroup(groupId),
        getCurrentUser(),
      ]);
      if (!g) { setNotFound(true); setLoading(false); return; }
      setGroup(g);

      // Check if current user is already a member
      const members = await getGroupMembers(groupId);
      setAlreadyMember(members.some(m => m.id === currentUser.id));
    } catch (e) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useFocusEffect(useCallback(() => { loadGroup(); }, [loadGroup]));

  const handleJoin = async () => {
    if (!group) return;
    setJoining(true);
    try {
      const currentUser = await getCurrentUser();
      await addGroupMember(group.id, currentUser.id);
      Alert.alert(
        'Joined! 🎉',
        `You've joined "${group.name}". You can now view and add expenses.`,
        [{ text: 'View Group', onPress: () => router.replace(`/group/${group.id}` as any) }]
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to join group. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (notFound || !group) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Ionicons name="link-outline" size={64} color={colors.textTertiary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Invite Not Found</Text>
          <Text style={[styles.errorSub, { color: colors.textSecondary }]}>
            This invite link may have expired or the group no longer exists.
          </Text>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.primary }]}
            onPress={() => router.replace('/(tabs)' as any)}
          >
            <Text style={styles.btnText}>Go Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const emoji = CATEGORY_EMOJI[group.category] || '👥';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={['#1CC29F20', 'transparent']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.5 }}
      />

      {/* Close button */}
      <Pressable
        onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)' as any)}
        style={[styles.closeBtn, { backgroundColor: colors.surface }]}
        hitSlop={12}
      >
        <Ionicons name="close" size={20} color={colors.text} />
      </Pressable>

      <View style={styles.content}>
        {/* Group Emoji Badge */}
        <Animated.View entering={ZoomIn.delay(100).springify()} style={[styles.emojiBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={styles.emojiText}>{emoji}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.textBlock}>
          <Text style={[styles.inviteLabel, { color: colors.textSecondary }]}>You've been invited to join</Text>
          <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
          <View style={[styles.membersBadge, { backgroundColor: colors.surface }]}>
            <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.membersText, { color: colors.textSecondary }]}>
              {group.member_count} {group.member_count === 1 ? 'member' : 'members'} · {group.category}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350).springify()} style={styles.infoBox}>
          {[
            { icon: 'wallet-outline', text: 'Track shared expenses together' },
            { icon: 'calculator-outline', text: 'Automatic fair splitting' },
            { icon: 'checkmark-circle-outline', text: 'See who owes who at a glance' },
          ].map((item, i) => (
            <View key={i} style={styles.infoItem}>
              <View style={[styles.infoIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name={item.icon as any} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>{item.text}</Text>
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(450).springify()} style={styles.actions}>
          {alreadyMember ? (
            <>
              <View style={[styles.alreadyBadge, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                <Text style={[styles.alreadyText, { color: colors.primary }]}>You're already a member</Text>
              </View>
              <Pressable
                style={[styles.btn, { backgroundColor: colors.primary }]}
                onPress={() => router.replace(`/group/${group.id}` as any)}
              >
                <Ionicons name="arrow-forward-outline" size={20} color="#FFF" />
                <Text style={styles.btnText}>View Group</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                style={[styles.btn, { backgroundColor: colors.primary, opacity: joining ? 0.7 : 1 }]}
                onPress={handleJoin}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name="person-add-outline" size={20} color="#FFF" />
                )}
                <Text style={styles.btnText}>{joining ? 'Joining...' : `Join ${group.name}`}</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
                onPress={() => router.replace('/(tabs)' as any)}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>Maybe later</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: Spacing.base,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  emojiBadge: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: { fontSize: 52 },
  textBlock: { alignItems: 'center', gap: 8 },
  inviteLabel: { fontSize: 15, fontWeight: '500' },
  groupName: { fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  membersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  membersText: { fontSize: 13, fontWeight: '500', textTransform: 'capitalize' },
  infoBox: { width: '100%', gap: Spacing.md },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoText: { fontSize: 15, flex: 1, fontWeight: '500' },
  actions: { width: '100%', gap: Spacing.md },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  btnText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600' },
  alreadyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  alreadyText: { fontSize: 15, fontWeight: '600' },
  errorTitle: { fontSize: 22, fontWeight: '700', marginTop: Spacing.lg, textAlign: 'center' },
  errorSub: { fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: Spacing.xl, lineHeight: 22 },
});
