/**
 * Create Group Screen
 */
import { Avatar } from '@/components/Avatar';
import { GroupCategoryColors } from '@/constants/Colors';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createGroup, getAllFriends, getCurrentUser, getGroupsCount, type User } from '../../lib/database';

const categories = Object.entries(GroupCategoryColors);

export default function CreateGroupScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('friends');
  const [friends, setFriends] = useState<User[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllFriends().then(setFriends);
  }, []);

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Please enter a group name.'); return; }
    setSaving(true);
    try {
      const [count, user] = await Promise.all([getGroupsCount(), getCurrentUser()]);
      
      if (count >= 3 && !user.is_pro) {
        setSaving(false);
        Alert.alert(
          'Limit Reached',
          'Free users can create up to 3 groups. Upgrade to Splitmaro Pro for unlimited groups!',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'View Pro Features', onPress: () => router.push('/pro/upgrade') }
          ]
        );
        return;
      }

      await createGroup(name.trim(), category, Array.from(selected));
      // Push immediately so other members see the group without waiting for AppState foreground
      require('@/lib/sync').pushToCloud().catch((e: any) => console.warn('[CreateGroup] Push failed:', e));
      router.back();
    } catch (e) {
      Alert.alert('Error', 'Failed to create group.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Group</Text>
        <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Create'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Group Name */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>GROUP NAME</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="e.g., Goa Trip 2026"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
          autoFocus
        />

        {/* Category */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORY</Text>
        <View style={styles.catGrid}>
          {categories.map(([key, cat]) => (
            <Pressable
              key={key}
              onPress={() => setCategory(key)}
              style={[
                styles.catChip,
                { backgroundColor: category === key ? cat.color + '20' : colors.surface, borderColor: category === key ? cat.color : colors.border },
              ]}
            >
              <Text style={styles.catEmoji}>{cat.emoji}</Text>
              <Text style={[styles.catText, { color: category === key ? cat.color : colors.textSecondary }]}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Members */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>ADD MEMBERS</Text>
        {friends.length === 0 && (
          <Pressable onPress={() => router.push('/friends/add')} style={[styles.addFriend, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="person-add-outline" size={20} color={colors.primary} />
            <Text style={[styles.addFriendText, { color: colors.primary }]}>Add a friend first</Text>
          </Pressable>
        )}
        {friends.map((f) => {
          const isSelected = selected.has(f.id);
          return (
            <Pressable key={f.id} onPress={() => toggle(f.id)} style={[styles.friendRow, { backgroundColor: colors.surface }]}>
              <Avatar name={f.name} color={f.avatar_color} size={40} />
              <Text style={[styles.friendName, { color: colors.text }]}>{f.name}</Text>
              <Ionicons name={isSelected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={isSelected ? colors.primary : colors.textTertiary} />
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: Spacing.md },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  saveBtn: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.xl },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  scroll: { padding: Spacing.base },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 20 },
  input: { padding: Spacing.base, borderRadius: BorderRadius.md, fontSize: 16, borderWidth: 1 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: BorderRadius.xl, borderWidth: 1.5, gap: 6 },
  catEmoji: { fontSize: 18 },
  catText: { fontSize: 13, fontWeight: '600' },
  addFriend: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, borderRadius: BorderRadius.md, borderWidth: 1, borderStyle: 'dashed', gap: 8 },
  addFriendText: { fontSize: 14, fontWeight: '600' },
  friendRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: 6, gap: 12 },
  friendName: { flex: 1, fontSize: 15, fontWeight: '600' },
});
