import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest, getGroup, type Group } from '../../lib/database';

export default function GroupInviteScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const colors = useThemeColors();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      if (!groupId) return;
      try {
        const [g, res] = await Promise.all([
          getGroup(groupId),
          apiRequest(`/api/groups/${groupId}/invite`, { method: 'POST' })
        ]);
        setGroup(g);
        
        let apiBase = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
        if (apiBase.startsWith('"') && apiBase.endsWith('"')) {
          apiBase = apiBase.slice(1, -1);
        }
        setInviteUrl(`${apiBase}${res.inviteUrl}`);
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Failed to generate invitation link');
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  const handleCopyLink = async () => {
    if (!inviteUrl) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLink = async () => {
    if (!inviteUrl || !group) return;
    Haptics.selectionAsync();
    try {
      await Share.share({
        message: `Hey! Join my "${group.name}" group on Splitmaro to track and settle our expenses together.\n\nInvite link: ${inviteUrl}`,
        title: `Join ${group.name} on Splitmaro`
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !group || !inviteUrl) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Generating invite token...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Generate gorgeous color-matched QR Code image URL
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(inviteUrl)}&color=6366f1&bgcolor=0d111d`;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Invite Friends</Text>
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.groupEmoji, { color: colors.primary }]}>👥</Text>
          <Text style={[styles.groupName, { color: colors.text }]}>{group.name}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Scan the QR code or share the link to join. Friends without the app can view and settle on the mobile web!
          </Text>

          {/* QR Code */}
          <View style={styles.qrBorder}>
            <Image source={{ uri: qrUrl }} style={styles.qrImage} />
          </View>

          {/* Link Box */}
          <Pressable onPress={handleCopyLink} style={[styles.linkBox, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
            <Ionicons name="link-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.linkText, { color: colors.textSecondary }]} numberOfLines={1}>
              {inviteUrl}
            </Text>
            <View style={[styles.copyBadge, { backgroundColor: copied ? colors.positive : colors.primary }]}>
              <Text style={styles.copyBadgeText}>{copied ? 'Copied' : 'Copy'}</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Share Button */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.actions}>
          <Pressable onPress={handleShareLink} style={[styles.shareBtn, { backgroundColor: colors.primary }]}>
            <Ionicons name="share-social-outline" size={20} color="#FFF" />
            <Text style={styles.shareBtnText}>Share Invitation Link</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', marginLeft: 12 },
  content: { flex: 1, padding: Spacing.base, justifyContent: 'center', gap: 24 },
  card: { padding: 24, borderRadius: BorderRadius.xl, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  groupEmoji: { fontSize: 48, marginBottom: 12 },
  groupName: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  qrBorder: { padding: 12, borderRadius: BorderRadius.xl, backgroundColor: '#0d111d', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: 24 },
  qrImage: { width: 200, height: 200, borderRadius: BorderRadius.md },
  linkBox: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1, width: '100%' },
  linkText: { flex: 1, fontSize: 13, fontWeight: '500' },
  copyBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.sm },
  copyBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  actions: { width: '100%' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: BorderRadius.md, width: '100%', shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  shareBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' }
});
