/**
 * Add Friend Screen
 */
import { Avatar } from '@/components/Avatar';
import { AvatarColors } from '@/constants/Colors';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addFriend, getUser, updateUser } from '../../lib/database';

export default function AddFriendScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const colors = useThemeColors();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedColor, setSelectedColor] = useState(AvatarColors[0]);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (id) {
      (async () => {
        const u = await getUser(id);
        if (u) {
          setName(u.name);
          setEmail(u.email || '');
          setPhone(u.phone || '');
          setSelectedColor(u.avatar_color);
        }
      })();
    }
  }, [id]);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Please enter a name.'); return; }
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail && !trimmedEmail.includes('@')) { Alert.alert('Error', 'Please enter a valid email address.'); return; }

    setSaving(true);
    try {
      if (id) {
        await updateUser(id, { name: name.trim(), email: trimmedEmail || undefined, phone: phone.trim() || undefined, avatar_color: selectedColor });
      } else {
        await addFriend(name.trim(), trimmedEmail || undefined, phone.trim() || undefined, selectedColor);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save friend.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{id ? 'Edit Friend' : 'Add Friend'}</Text>
        <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}>
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : id ? 'Save' : 'Add'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Preview */}
        <View style={styles.preview}>
          <Avatar name={name || '?'} color={selectedColor} size={80} fontSize={28} />
          {name.trim() !== '' && <Text style={[styles.previewName, { color: colors.text }]}>{name}</Text>}
        </View>

        {/* Avatar color */}
        <Text style={[styles.label, { color: colors.textSecondary }]}>AVATAR COLOR</Text>
        <View style={styles.colorRow}>
          {AvatarColors.map(c => (
            <Pressable
              key={c}
              onPress={() => setSelectedColor(c)}
              style={[styles.colorDot, { backgroundColor: c, borderWidth: selectedColor === c ? 3 : 0, borderColor: colors.text }]}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>NAME *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Friend's name"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>EMAIL (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="friend@example.com"
          placeholderTextColor={colors.textTertiary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>PHONE (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="+91 9876543210"
          placeholderTextColor={colors.textTertiary}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: BorderRadius.xl },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  scroll: { padding: Spacing.base },
  preview: { alignItems: 'center', paddingVertical: Spacing.xl },
  previewName: { fontSize: 20, fontWeight: '700', marginTop: 12 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 20 },
  input: { padding: Spacing.base, borderRadius: BorderRadius.md, fontSize: 16, borderWidth: 1 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
});
