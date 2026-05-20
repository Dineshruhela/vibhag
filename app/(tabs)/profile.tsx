/**
 * Profile Screen
 */
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { AvatarColors } from '@/constants/Colors';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useSync } from '@/hooks/useSync';
import { useThemeColors } from '@/hooks/useThemeColor';
import { api } from '@/lib/api';
import { cancelAllNotifications, scheduleDailyDebtReminder } from '@/lib/notifications';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearAllLocalData, clearLocalDatabase, getCurrentUser, updateUser, type User } from '../../lib/database';
import { pullFromCloud } from '../../lib/sync';

const UPI_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/;
const NOTIF_PREF_KEY = 'splitmaro_notifications_enabled';

export default function ProfileScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const { session } = useSync();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [upiId, setUpiId] = useState('');
  const [saving, setSaving] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const loadUser = async () => {
    try {
      const u = await getCurrentUser();
      if (!u) throw new Error('No user found');
      setUser(u);
      setName(u.name);
      setUpiId(u.upi_id || '');
    } catch {
      setUser(null);
      Alert.alert('No User Found', 'No user exists in the app. Please sign in or create an account.');
    }
  };

  useEffect(() => {
    loadUser();
    AsyncStorage.getItem(NOTIF_PREF_KEY).then(val => {
      if (val !== null) setNotificationsEnabled(val === 'true');
    });
  }, []);

  const handleRefresh = async () => {
    await pullFromCloud();
    await loadUser();
    Alert.alert('Refreshed', 'Profile synced with server.');
  };

  const handleSave = async () => {
    if (!user) return;
    const trimmedUpi = upiId.trim();
    if (trimmedUpi && !UPI_REGEX.test(trimmedUpi)) {
      Alert.alert('Invalid UPI ID', 'UPI ID must be in the format username@bankcode (e.g. john@okaxis).');
      return;
    }
    setSaving(true);
    try {
      await updateUser(user.id, { name: name.trim(), upi_id: trimmedUpi || null });
      const updated = await getCurrentUser();
      setUser(updated);
      Alert.alert('Success', 'Profile updated');
    } catch (e) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const updateColor = async (color: string) => {
    if (!user) return;
    try {
      await updateUser(user.id, { avatar_color: color });
      const updated = await getCurrentUser();
      setUser(updated);
    } catch (e) {
      Alert.alert('Error', 'Failed to update avatar color');
    }
  };

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    await AsyncStorage.setItem(NOTIF_PREF_KEY, String(value));
    if (value) {
      await scheduleDailyDebtReminder();
    } else {
      await cancelAllNotifications();
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.logout();
            await clearLocalDatabase();
            await AsyncStorage.removeItem('last_sync_timestamp');
            DeviceEventEmitter.emit('auth_change');
            router.replace('/auth/login');
          } catch (e) {
            Alert.alert('Error', 'Failed to sign out');
          }
        }
      }
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'Are you sure? This will wipe all your local data and sign you out.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Permanently',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.logout();
            await clearAllLocalData();
            DeviceEventEmitter.emit('auth_change');
            router.replace('/auth/login');
          } catch (e) {
            Alert.alert('Error', 'Failed to delete account');
          }
        }
      }
    ]);
  };

  const handleClearAllLocal = async () => {
    await clearAllLocalData();
    Alert.alert('Local Data Cleared', 'All local app data has been wiped.');
    DeviceEventEmitter.emit('auth_change');
    router.replace('/auth/login');
  };

  if (!user) return <View style={[styles.root, { backgroundColor: colors.background }]} />;

  const isPro = !!user.is_pro;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        
        <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.header, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}> 
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Avatar name={user.name} color={user.avatar_color} size={80} fontSize={32} />
            <Text style={[styles.title, { color: colors.text }]}>Your Profile</Text>
          </View>
          <Pressable onPress={handleRefresh} style={{ padding: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginLeft: 12 }}>
            <Ionicons name="refresh" size={22} color={colors.primary} />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
            <TextInput
              style={[styles.inputField, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textTertiary}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>UPI ID (Optional)</Text>
            <TextInput
              style={[styles.inputField, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={upiId}
              onChangeText={setUpiId}
              placeholder="e.g. username@okaxis"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
            />
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>
              Used for friends to pay you directly.
            </Text>
          </View>

          {(name.trim() !== user.name || upiId.trim() !== (user.upi_id || '')) && (
            <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.saveBtnText}>{saving ? '...' : 'Save Changes'}</Text>
            </Pressable>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).springify()}>
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.xl }]}>SUBSCRIPTION</Text>
          <Card variant="default" padding={0} style={{ overflow: 'hidden' }}>
            <View style={[styles.proRow, { backgroundColor: isPro ? colors.primary + '10' : colors.surface }]}>
              <View style={[styles.proIcon, { backgroundColor: isPro ? colors.primary : colors.textTertiary }]}>
                <Ionicons name="diamond-outline" size={20} color="#FFF" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>
                  {isPro ? 'Splitmaro Pro' : 'Free Version'}
                </Text>
                <Text style={[styles.infoSub, { color: colors.textTertiary }]}>
                  {isPro ? 'Unlimited groups & premium features' : 'Limit: 3 active groups'}
                </Text>
              </View>
              {!isPro ? (
                <Pressable
                  onPress={() => router.push('/pro/upgrade')}
                  style={[styles.upgradeBadge, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.upgradeBadgeText}>Upgrade</Text>
                </Pressable>
              ) : (
                <View style={[styles.proBadge, { borderColor: colors.primary }]}>
                  <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>ACTIVE</Text>
                </View>
              )}
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.xl }]}>AVATAR COLOR</Text>
          <Card variant="default" style={styles.colorCard}>
            <View style={styles.colorGrid}>
              {AvatarColors.map(color => (
                <Pressable
                  key={color}
                  onPress={() => updateColor(color)}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    user.avatar_color === color && { borderWidth: 3, borderColor: colors.text }
                  ]}
                />
              ))}
            </View>
          </Card>
        </Animated.View>

        {Platform.OS !== 'web' && (
          <Animated.View entering={FadeInDown.delay(400).springify()}>
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.xl }]}>NOTIFICATIONS</Text>
            <Card variant="default" padding={0}>
              <View style={styles.infoRow}>
                <View style={[styles.notifIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="notifications-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={[styles.infoTitle, { color: colors.text }]}>Debt Reminders</Text>
                  <Text style={[styles.infoSub, { color: colors.textTertiary }]}>Daily reminder at 7 PM when you have outstanding balances</Text>
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={toggleNotifications}
                  trackColor={{ false: colors.border, true: colors.primary + '80' }}
                  thumbColor={notificationsEnabled ? colors.primary : colors.textTertiary}
                />
              </View>
            </Card>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(450).springify()}>
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.xl }]}>CLOUD SYNC</Text>
          <Card variant="default" padding={0}>
            <View style={styles.infoRow}>
              <View style={[styles.notifIcon, { backgroundColor: session ? colors.primary + '20' : colors.textSecondary + '20' }]}>
                <Ionicons name="cloud-done-outline" size={20} color={session ? colors.primary : colors.textSecondary} />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={[styles.infoTitle, { color: colors.text }]}>Data Backup</Text>
                <Text style={[styles.infoSub, { color: colors.textTertiary }]}>
                  {session ? `Synced as ${session.user.email}` : 'Sign in to back up your data'}
                </Text>
              </View>
              {!session ? (
                <Pressable onPress={() => router.push('/auth/login')} style={[styles.upgradeBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.upgradeBadgeText}>Sign In</Text>
                </Pressable>
              ) : (
                <Pressable onPress={handleSignOut} style={[styles.upgradeBadge, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
                  <Text style={[styles.upgradeBadgeText, { color: colors.textSecondary }]}>Log Out</Text>
                </Pressable>
              )}
            </View>
          </Card>
        </Animated.View>

        <View style={{ height: 40 }} />
        
        <Pressable onPress={handleDeleteAccount} style={styles.deleteBtn}>
          <Text style={styles.deleteBtnText}>Delete Account & Data</Text>
        </Pressable>
        <Pressable onPress={handleClearAllLocal} style={[styles.deleteBtn, { marginTop: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.negative }] }>
          <Text style={[styles.deleteBtnText, { color: colors.negative }]}>Clear All Local Data</Text>
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: Spacing.xl },
  header: { alignItems: 'center', marginBottom: Spacing.xl, gap: Spacing.md },
  title: { fontSize: 24, fontWeight: '800' },
  inputGroup: { marginBottom: Spacing.lg },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  inputField: { padding: Spacing.md, borderRadius: BorderRadius.md, fontSize: 16, borderWidth: 1 },
  saveBtn: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: 4 },
  saveBtnText: { color: '#FFF', fontWeight: '700' },
  colorCard: { padding: Spacing.md },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  colorCircle: { width: 44, height: 44, borderRadius: 22 },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md },
  infoTextContainer: { flex: 1 },
  infoTitle: { fontSize: 16, fontWeight: '600' },
  infoSub: { fontSize: 13, marginTop: 2 },
  notifIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  proRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: Spacing.md },
  proIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  upgradeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.xl },
  upgradeBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  proBadge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  deleteBtn: { alignItems: 'center', padding: Spacing.md },
  deleteBtnText: { color: '#FF4444', fontSize: 14, fontWeight: '600' },
});
