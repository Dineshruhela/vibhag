/**
 * Add Expense Screen
 */
import { Avatar } from '@/components/Avatar';
import { CategoryColors } from '@/constants/Colors';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createExpense, getCurrentUser, getGroupMembers, uploadReceiptImage, type User } from '../../lib/database';

const categories = Object.entries(CategoryColors);

export default function AddExpenseScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const colors = useThemeColors();
  const router = useRouter();
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [category, setCategory] = useState('general');
  const [members, setMembers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [paidBy, setPaidBy] = useState<string>('');
  const [splitType] = useState<'equal'>('equal');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState('Saving...');
  const [notes, setNotes] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [recurringType, setRecurringType] = useState<'none' | 'weekly' | 'monthly' | 'yearly'>('none');

  useEffect(() => {
    (async () => {
      const [m, cu] = await Promise.all([getGroupMembers(groupId!), getCurrentUser()]);
      setMembers(m);
      setCurrentUser(cu);
      setPaidBy(cu.id);
    })();
  }, [groupId]);

  const toggleExclude = (id: string) => {
    Haptics.selectionAsync();
    const s = new Set(excluded);
    s.has(id) ? s.delete(id) : s.add(id);
    if (s.size < members.length) setExcluded(s);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5, // compress for quicker upload
      base64: true,
    });

    if (!result.canceled) {
      setReceiptUri(result.assets[0].uri);
      setReceiptBase64(result.assets[0].base64 || null);
      const filename = result.assets[0].uri.split('/').pop() || 'receipt.jpg';
      setReceiptName(filename);
    }
  };

  const handleSave = async () => {
    if (!desc.trim()) { Alert.alert('Error', 'Enter a description.'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Error', 'Enter a valid amount.'); return; }

    setSaving(true);
    try {
      const included = members.filter(m => !excluded.has(m.id));
      if (included.length === 0) {
        Alert.alert('Error', 'At least one person must be included in the split.');
        setSaving(false);
        return;
      }
      const shareAmt = Math.round((amt / included.length) * 100) / 100;

      let uploadedUrl: string | undefined = undefined;
      if (receiptUri && receiptBase64 && receiptName) {
        setSavingMessage('Uploading receipt...');
        try {
          uploadedUrl = await uploadReceiptImage(receiptBase64, receiptName);
        } catch (uploadErr) {
          console.warn('[AddExpense] Image upload failed:', uploadErr);
          const proceed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Upload Failed',
              'Failed to upload receipt photo. Save expense without photo?',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Save Without Photo', style: 'default', onPress: () => resolve(true) }
              ]
            );
          });
          if (!proceed) {
            setSaving(false);
            return;
          }
        }
      }

      setSavingMessage('Saving expense...');
      await createExpense({
        groupId: groupId!,
        description: desc.trim(),
        amount: amt,
        currency,
        category,
        splitType: 'equal',
        payers: [{ userId: paidBy, amount: amt }],
        shares: included.map(m => ({ userId: m.id, shareAmount: shareAmt })),
        recurringType,
        isRecurringParent: recurringType !== 'none',
        notes: notes.trim() || undefined,
        receiptUri: uploadedUrl || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Push immediately so other members see the expense without waiting for AppState foreground
      require('@/lib/sync').pushToCloud().catch((e: any) => console.warn('[AddExpense] Push failed:', e));
      router.back();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to add expense.');
      console.error(e);
    } finally {
      setSaving(false);
      setSavingMessage('Saving...');
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Add Expense</Text>
          <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}>
            <Text style={styles.saveBtnText}>{saving ? savingMessage : 'Save'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Amount */}
          <View style={[styles.amountBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.currencySymbol, { color: colors.primary }]}>
              {currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '₹'}
            </Text>
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

          {/* Currency */}
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.sm }]}>CURRENCY</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: Spacing.md }}>
            {['INR', 'USD', 'EUR', 'GBP'].map((cur) => (
              <Pressable
                key={cur}
                onPress={() => setCurrency(cur)}
                style={[styles.currencyChip, {
                  backgroundColor: currency === cur ? colors.primary + '20' : colors.surface,
                  borderColor: currency === cur ? colors.primary : colors.border,
                }]}
              >
                <Text style={[styles.currencyText, { color: currency === cur ? colors.primary : colors.textSecondary }]}>{cur}</Text>
              </Pressable>
            ))}
          </View>

          {/* Description */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="What's this for?"
            placeholderTextColor={colors.textTertiary}
            value={desc}
            onChangeText={setDesc}
          />

          {/* Notes */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>NOTES (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Add details, link to receipt, etc."
            placeholderTextColor={colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          {/* Receipt Image */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>RECEIPT PHOTO</Text>
          {receiptUri ? (
            <View style={styles.receiptPreviewContainer}>
              <Image source={{ uri: receiptUri }} style={[styles.receiptImage, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} />
              <Pressable style={styles.receiptRemoveBtn} onPress={() => setReceiptUri(null)}>
                <Ionicons name="close-circle" size={24} color="#FF3B30" />
              </Pressable>
            </View>
          ) : (
            <Pressable 
              onPress={pickImage}
              style={[styles.receiptBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="camera-outline" size={24} color={colors.primary} />
              <Text style={[styles.receiptBtnText, { color: colors.primary }]}>Add Receipt Photo</Text>
            </Pressable>
          )}

          {/* Category */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
            {categories.map(([key, cat]) => (
              <Pressable
                key={key}
                onPress={() => setCategory(key)}
                style={[styles.catChip, {
                  backgroundColor: category === key ? cat.color + '20' : colors.surface,
                  borderColor: category === key ? cat.color : colors.border,
                }]}
              >
                <Ionicons name={cat.icon as any} size={16} color={category === key ? cat.color : colors.textTertiary} />
                <Text style={[styles.catText, { color: category === key ? cat.color : colors.textSecondary }]}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Paid by */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>PAID BY</Text>
          <View style={styles.paidRow}>
            {members.map(m => (
              <Pressable
                key={m.id}
                onPress={() => setPaidBy(m.id)}
                style={[styles.payerChip, {
                  backgroundColor: paidBy === m.id ? colors.primary + '20' : colors.surface,
                  borderColor: paidBy === m.id ? colors.primary : colors.border,
                }]}
              >
                <Avatar name={m.name} color={m.avatar_color} size={24} fontSize={9} />
                <Text style={[styles.payerName, { color: paidBy === m.id ? colors.primary : colors.textSecondary }]}>
                  {m.is_current_user ? 'You' : m.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Split among */}
          <Text style={[styles.label, { color: colors.textSecondary }]}>SPLIT EQUALLY AMONG</Text>
          {members.map(m => {
            const isExcluded = excluded.has(m.id);
            return (
              <Pressable key={m.id} onPress={() => toggleExclude(m.id)} style={[styles.splitRow, { backgroundColor: colors.surface }]}>
                <Avatar name={m.name} color={isExcluded ? colors.textTertiary : m.avatar_color} size={36} fontSize={12} />
                <Text style={[styles.splitName, { color: isExcluded ? colors.textTertiary : colors.text }]}>
                  {m.is_current_user ? 'You' : m.name}
                </Text>
                <Ionicons
                  name={isExcluded ? 'close-circle' : 'checkmark-circle'}
                  size={24}
                  color={isExcluded ? colors.textTertiary : colors.primary}
                />
              </Pressable>
            );
          })}

          {/* Share preview */}
          {amount && parseFloat(amount) > 0 && (
            <View style={[styles.preview, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.previewText, { color: colors.primary }]}>
                {formatShare(parseFloat(amount), members.length - excluded.size)} per person
              </Text>
            </View>
          )}

          {/* Recurring */}
          <View style={styles.recurringSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>RECURRING</Text>
              {currentUser && !currentUser.is_pro && (
                <View style={[styles.proBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>
            
            <View style={styles.recurringOptions}>
              {(['none', 'weekly', 'monthly', 'yearly'] as const).map((type) => (
                <Pressable
                  key={type}
                  disabled={currentUser && !currentUser.is_pro && type !== 'none'}
                  onPress={() => {
                    setRecurringType(type);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    styles.recurringChip,
                    {
                      backgroundColor: recurringType === type ? colors.primary + '20' : colors.surface,
                      borderColor: recurringType === type ? colors.primary : colors.border,
                      opacity: (currentUser && !currentUser.is_pro && type !== 'none') ? 0.5 : 1
                    }
                  ]}
                >
                  <Text style={[
                    styles.recurringText,
                    { color: recurringType === type ? colors.primary : colors.textSecondary }
                  ]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            
            {currentUser && !currentUser.is_pro && recurringType === 'none' && (
              <Pressable onPress={() => router.push('/pro/upgrade')} style={styles.proHint}>
                <Ionicons name="diamond-outline" size={14} color={colors.primary} />
                <Text style={[styles.proHintText, { color: colors.primary }]}>Upgrade to Pro for recurring expenses</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatShare(total: number, count: number): string {
  if (count <= 0) return '₹0.00';
  const share = Math.round((total / count) * 100) / 100;
  return `₹${share.toFixed(2)}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: 12 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: BorderRadius.xl },
  saveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  scroll: { padding: Spacing.base, paddingBottom: 60 },
  amountBox: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderRadius: BorderRadius.xl, marginBottom: Spacing.sm },
  currencySymbol: { fontSize: 32, fontWeight: '800', marginRight: 8 },
  amountInput: { flex: 1, fontSize: 36, fontWeight: '800', padding: 0 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  currencyChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  currencyText: { fontSize: 14, fontWeight: '600' },
  input: { padding: Spacing.base, borderRadius: BorderRadius.md, fontSize: 16, borderWidth: 1 },
  catScroll: { marginBottom: 4 },
  catChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 6, marginRight: 8 },
  catText: { fontSize: 12, fontWeight: '600' },
  paidRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  payerChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, gap: 6 },
  payerName: { fontSize: 13, fontWeight: '600' },
  splitRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: BorderRadius.md, marginBottom: 4, gap: 10 },
  splitName: { flex: 1, fontSize: 15, fontWeight: '600' },
  preview: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', marginTop: 12 },
  previewText: { fontSize: 14, fontWeight: '700' },
  recurringSection: { marginTop: Spacing.xl, marginBottom: Spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  proBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  proBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  recurringOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recurringChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  recurringText: { fontSize: 13, fontWeight: '600' },
  proHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md },
  proHintText: { fontSize: 12, fontWeight: '600' },
  receiptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: BorderRadius.md, borderWidth: 1, borderStyle: 'dashed' },
  receiptBtnText: { fontSize: 14, fontWeight: '600' },
  receiptPreviewContainer: { position: 'relative', alignSelf: 'flex-start' },
  receiptImage: { width: 100, height: 100, borderRadius: BorderRadius.md, borderWidth: 1 },
  receiptRemoveBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: '#FFF', borderRadius: 12 },
});
