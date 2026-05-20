/**
 * Settle Up Screen
 */
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { formatCurrency } from '@/lib/format';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createSettlement } from '../../lib/database';

export default function SettleScreen() {
  const { groupId, fromId, toId, amount: suggestedAmount } = useLocalSearchParams<{
    groupId: string; fromId: string; toId: string; amount: string;
  }>();
  const colors = useThemeColors();
  const router = useRouter();
  const [amount, setAmount] = useState(suggestedAmount || '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSettle = async () => {
    const amt = parseFloat(amount);
    const maxAmt = suggestedAmount ? parseFloat(suggestedAmount) : null;
    if (!amt || amt <= 0 || isNaN(amt)) { Alert.alert('Error', 'Enter a valid amount.'); return; }
    if (maxAmt !== null && !isNaN(maxAmt) && amt > maxAmt + 0.01) {
      Alert.alert('Invalid Amount', `Maximum settlement amount is ${formatCurrency(maxAmt)}.`);
      return;
    }
    setSaving(true);
    try {
      await createSettlement(groupId!, fromId!, toId!, amt, note.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to record settlement.');
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Record Settlement</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.amountBox, { backgroundColor: colors.surface }]}>
          <Text style={[styles.currency, { color: colors.primary }]}>₹</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.text }]}
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>

        <TextInput
          style={[styles.noteInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
          placeholder="Add a note (optional)"
          placeholderTextColor={colors.textTertiary}
          value={note}
          onChangeText={setNote}
        />

        <Pressable
          onPress={handleSettle}
          disabled={saving}
          style={[styles.settleBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
        >
          <Ionicons name="checkmark-circle" size={22} color="#FFF" />
          <Text style={styles.settleBtnText}>{saving ? 'Recording...' : 'Record Payment'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  content: { padding: Spacing.base, flex: 1 },
  amountBox: { flexDirection: 'row', alignItems: 'center', padding: Spacing.xl, borderRadius: BorderRadius.xl, marginBottom: Spacing.lg },
  currency: { fontSize: 32, fontWeight: '800', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 36, fontWeight: '800', padding: 0 },
  noteInput: { padding: Spacing.base, borderRadius: BorderRadius.md, fontSize: 16, borderWidth: 1, marginBottom: Spacing.xl },
  settleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Spacing.base, borderRadius: BorderRadius.xl, gap: 8 },
  settleBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
