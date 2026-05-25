/**
 * Splitmaro Referrals Dashboard Screen
 */
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Share,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { apiRequest } from '../../lib/api';

interface ReferredUser {
  id: string;
  name: string;
  email: string | null;
  avatar_color: string;
  created_at: number;
}

interface ReferralStats {
  referralCode: string;
  isPro: boolean;
  referralCount: number;
  referredUsers: ReferredUser[];
}

export default function ReferralsScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ReferralStats | null>(null);

  const fetchReferralStats = async () => {
    try {
      const data = await apiRequest('/api/referrals/stats');
      setStats(data);
    } catch (e: any) {
      console.error('[ReferralsScreen] Error fetching stats:', e);
      Alert.alert('Error', 'Failed to load referral details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralStats();
  }, []);

  const handleCopyCode = async () => {
    if (!stats) return;
    await Clipboard.setStringAsync(stats.referralCode);
    Alert.alert('Code Copied! 📋', 'Your referral code has been copied to the clipboard. Share it with your friends!');
  };

  const handleShare = async () => {
    if (!stats) return;
    try {
      const message = `Join me on Splitmaro, the premium expense sharing app! 🚀 Split bills beautifully and manage budgets like a pro. Use my referral code during signup:\n\n💎 CODE: ${stats.referralCode}\n\nDownload now and unlock Splitmaro Pro!`;
      await Share.share({
        message,
      });
    } catch (e) {
      console.error('[ReferralsScreen] Share failed:', e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading referral stats...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const referralCount = stats?.referralCount || 0;
  const progressPercent = Math.min((referralCount / 3) * 100, 100);
  const progressText = referralCount >= 3 
    ? 'Splitmaro Pro Unlocked! 💎' 
    : `${3 - referralCount} more referral${3 - referralCount === 1 ? '' : 's'} to unlock Pro!`;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Referrals</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.hero}>
          <View style={[styles.giftIconContainer, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="gift-outline" size={42} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Invite & Get Pro</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Unlock 30 days of Splitmaro Pro for free by successfully introducing 3 co-splitters.
          </Text>
        </Animated.View>

        {/* Progress Tracker Card */}
        <Animated.View 
          entering={FadeInDown.delay(200).springify()} 
          style={[styles.glassCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Your Progress</Text>
            <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>{referralCount} / 3 Joined</Text>
            </View>
          </View>

          <Text style={[styles.progressSubtitle, { color: colors.textSecondary }]}>
            {progressText}
          </Text>

          {/* Progress Bar Container */}
          <View style={[styles.progressBarContainer, { backgroundColor: colors.borderLight }]}>
            <Animated.View 
              style={[
                styles.progressBar, 
                { 
                  width: `${progressPercent}%`, 
                  backgroundColor: colors.primary 
                }
              ]} 
            />
          </View>

          {/* Steps visual indicators */}
          <View style={styles.stepsContainer}>
            {[1, 2, 3].map((step) => {
              const completed = referralCount >= step;
              return (
                <View key={step} style={styles.stepItem}>
                  <View 
                    style={[
                      styles.stepCircle, 
                      { 
                        backgroundColor: completed ? colors.primary : colors.surfaceSecondary,
                        borderColor: completed ? colors.primary : colors.border
                      }
                    ]}
                  >
                    {completed ? (
                      <Ionicons name="checkmark" size={14} color="#FFF" />
                    ) : (
                      <Text style={[styles.stepNumber, { color: colors.textTertiary }]}>{step}</Text>
                    )}
                  </View>
                  <Text style={[styles.stepLabel, { color: completed ? colors.text : colors.textTertiary }]}>
                    {step === 3 ? 'Pro Unlocked 💎' : `Friend ${step}`}
                  </Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Referral Code Card */}
        <Animated.View 
          entering={FadeInDown.delay(300).springify()} 
          style={[styles.glassCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 8 }]}>Your Unique Code</Text>
          <Text style={[styles.codeDesc, { color: colors.textSecondary }]}>
            Ask friends to enter this code when registering their account to count them as your referrals.
          </Text>

          <View style={[styles.codeBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Text style={[styles.codeText, { color: colors.text }]} numberOfLines={1}>
              {stats?.referralCode}
            </Text>
            <Pressable 
              onPress={handleCopyCode} 
              style={[styles.copyBtn, { backgroundColor: colors.primary }]}
              android_ripple={{ color: colors.primaryDark }}
            >
              <Ionicons name="copy-outline" size={18} color="#FFF" />
              <Text style={styles.copyBtnText}>Copy</Text>
            </Pressable>
          </View>

          <Pressable 
            onPress={handleShare} 
            style={[styles.shareBtn, { borderColor: colors.primary }]}
          >
            <Ionicons name="share-social-outline" size={20} color={colors.primary} />
            <Text style={[styles.shareBtnText, { color: colors.primary }]}>Share Invite Link</Text>
          </Pressable>
        </Animated.View>

        {/* Referred List Card */}
        <Animated.View 
          entering={FadeInDown.delay(400).springify()} 
          style={[styles.glassCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 16 }]}>Referred Friends ({referralCount})</Text>

          {(!stats?.referredUsers || stats.referredUsers.length === 0) ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                No referrals yet. Share your code to get started!
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {stats.referredUsers.map((user, index) => {
                const dateStr = new Date(user.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
                return (
                  <View 
                    key={user.id} 
                    style={[
                      styles.userRow, 
                      index < stats.referredUsers.length - 1 ? { borderBottomColor: colors.borderLight, borderBottomWidth: 1 } : {}
                    ]}
                  >
                    <View style={[styles.avatar, { backgroundColor: user.avatar_color }]}>
                      <Text style={styles.avatarText}>
                        {user.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: colors.text }]}>{user.name}</Text>
                      <Text style={[styles.userDate, { color: colors.textSecondary }]}>Joined {dateStr}</Text>
                    </View>
                    <View style={[styles.successBadge, { backgroundColor: colors.success + '15' }]}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                      <Text style={[styles.successBadgeText, { color: colors.success }]}>Success</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  loadingText: { marginTop: Spacing.md, fontSize: 16, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  scroll: {
    padding: Spacing.base,
    gap: Spacing.base,
  },
  hero: {
    alignItems: 'center',
    textAlign: 'center',
    marginVertical: Spacing.base,
    paddingHorizontal: Spacing.lg,
  },
  giftIconContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  glassCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  progressSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: Spacing.md,
  },
  progressBarContainer: {
    height: 10,
    borderRadius: BorderRadius.full,
    width: '100%',
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  progressBar: {
    height: '100%',
    borderRadius: BorderRadius.full,
  },
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  stepItem: {
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '700',
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  codeDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingLeft: Spacing.base,
    paddingRight: Spacing.xs,
    height: 52,
    marginBottom: Spacing.base,
  },
  codeText: {
    fontSize: 15,
    fontFamily: 'System',
    fontWeight: '600',
    flex: 1,
    marginRight: Spacing.sm,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.md,
  },
  copyBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: BorderRadius.lg,
    height: 52,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.xl,
  },
  listContainer: {
    gap: Spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  userDate: {
    fontSize: 12,
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  successBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
