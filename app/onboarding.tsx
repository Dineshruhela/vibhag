import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUser, updateUser } from '../lib/database';

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your name');
      return;
    }
    setSaving(true);
    try {
      const u = await getCurrentUser();
      await updateUser(u.id, { name: name.trim() });
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Error', 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="person" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Welcome to Splitmaro</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Let's set up your profile before we get started with splitting expenses.
        </Text>

        <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Your Name"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoFocus
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.btn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
        >
          <Text style={styles.btnText}>{saving ? 'Saving...' : 'Continue'}</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.xl },
  iconBox: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, lineHeight: 24, marginBottom: Spacing.xl },
  inputContainer: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.base, marginBottom: Spacing.xl },
  input: { fontSize: 18 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, borderRadius: BorderRadius.xl, gap: 8 },
  btnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
});
