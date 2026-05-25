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
import { getCurrentUser, getExpense, getExpensePayers, getGroupMembers, updateExpense, uploadReceiptImage, type User } from '../../../lib/database';

const categories = Object.entries(CategoryColors);

export default function EditExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const router = useRouter();
  const [groupId, setGroupId] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [notes, setNotes] = useState('');
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);
  const [category, setCategory] = useState('general');
  const [recurringType, setRecurringType] = useState<string>('none');
  const [isRecurringParent, setIsRecurringParent] = useState(false);
  const [members, setMembers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [paidBy, setPaidBy] = useState<string>('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState('Saving...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const exp = await getExpense(id!);
        if (!exp) {
          router.back();
          return;
        }
        setGroupId(exp.group_id);
        setDesc(exp.description);
        setAmount(exp.amount.toString());
        setCurrency(exp.currency || 'INR');
        setNotes(exp.notes || '');
        setReceiptUri(exp.receipt_uri || null);
        setCategory(exp.category);
        setRecurringType(exp.recurring_type || 'none');
        setIsRecurringParent(exp.is_recurring_parent === 1);

        const [m, cu, payers] = await Promise.all([
          getGroupMembers(exp.group_id),
          getCurrentUser(),
          getExpensePayers(id!)
        ]);
        
        setMembers(m);
        setCurrentUser(cu);
        if (payers.length > 0) {
          setPaidBy(payers[0].user_id);
        } else {
          setPaidBy(cu.id);
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to load expense');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const toggleExclude = (userId: string) => {
    Haptics.selectionAsync();
    const s = new Set(excluded);
    s.has(userId) ? s.delete(userId) : s.add(userId);
    if (s.size < members.length) setExcluded(s);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled) {
      setReceiptUri(result.assets[0].uri);
      setReceiptBase64(result.assets[0].base64 || null);
      const filename = result.assets[0].uri.split('/').pop() || 'receipt.jpg';
      setReceiptName(filename);
    }
  };

  const stopRecurring = async () => {
    Alert.alert('Stop Recurring', 'Are you sure you want to stop this recurring expense?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: async () => {
        try {
          setSaving(true);
          await updateExpense(id!, { recurringType: 'none', isRecurringParent: false });
          setRecurringType('none');
          setIsRecurringParent(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Recurring Stopped', 'This expense will no longer auto-generate.');
        } catch (e) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Error', 'Failed to stop recurring.');
        } finally {
          setSaving(false);
        }
      }}
    ]);
  };

  const handleSave = async () => {
    if (!desc.trim()) { Alert.alert('Error', 'Enter a description.'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Error', 'Enter a valid amount.'); return; }

    setSaving(true);
    try {
      const included = members.filter(m => !excluded.has(m.id));
      const shareAmt = Math.round((amt / included.length) * 100) / 100;

      let uploadedUrl: string | undefined = undefined;
      // Only upload if receiptUri is set and has base64 data (meaning a new file was picked)
      // Otherwise, keep the existing remote URL or null if removed.
      if (receiptUri && receiptBase64 && receiptName) {
        setSavingMessage('Uploading receipt...');
        try {
          uploadedUrl = await uploadReceiptImage(receiptBase64, receiptName);
        } catch (uploadErr) {
          console.warn('[EditExpense] Image upload failed:', uploadErr);
          const proceed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Upload Failed',
              'Failed to upload receipt photo. Save changes without photo?',
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

      setSavingMessage('Saving changes...');
      await updateExpense(id!, {
        groupId,
        description: desc.trim(),
        amount: amt,
        currency,
        category,
        notes: notes.trim() || undefined,
        // If uploadedUrl is set, save that URL. If receiptUri is null, clear the receipt.
        // Otherwise, keep the original remote URI.
        receiptUri: uploadedUrl !== undefined ? uploadedUrl : (receiptUri || null),
        recurringType: recurringType as 'none' | 'weekly' | 'monthly' | 'yearly',
        isRecurringParent: isRecurringParent,
        payers: [{ userId: paidBy, amount: amt }],
        shares: included.map(m => ({ userId: m.id, shareAmount: shareAmt })),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to update expense.');
    } finally {
      setSaving(false);
      setSavingMessage('Saving...');
    }
  };

  if (loading) return <View style={[styles.root, { backgroundColor: colors.background }]} />;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Expense</Text>
          <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}>
            <Text style={styles.saveBtnText}>{saving ? savingMessage : 'Save'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
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
            />
          </View>

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

          <Text style={[styles.label, { color: colors.textSecondary }]}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            placeholder="What's this for?"
            placeholderTextColor={colors.textTertiary}
            value={desc}
            onChangeText={setDesc}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>NOTES (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Add details, link to receipt, etc."
            placeholderTextColor={colors.textTertiary}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

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

          {isRecurringParent && (
            <View style={styles.recurringSection}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>RECURRING SUBSCRIPTION</Text>
              </View>
              <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: Spacing.md }}>
                This is a {recurringType} recurring expense. Future expenses will be auto-generated based on these settings.
              </Text>
              <Pressable onPress={stopRecurring} style={[styles.stopBtn, { borderColor: '#FF3B30' }]}>
                <Ionicons name="stop-circle-outline" size={20} color="#FF3B30" />
                <Text style={[styles.stopBtnText, { color: '#FF3B30' }]}>Stop Recurring</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
  receiptBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: BorderRadius.md, borderWidth: 1, borderStyle: 'dashed', marginBottom: Spacing.sm },
  receiptBtnText: { fontSize: 14, fontWeight: '600' },
  receiptPreviewContainer: { position: 'relative', alignSelf: 'flex-start', marginBottom: Spacing.sm },
  receiptImage: { width: 100, height: 100, borderRadius: BorderRadius.md, borderWidth: 1 },
  receiptRemoveBtn: { position: 'absolute', top: -10, right: -10, backgroundColor: '#FFF', borderRadius: 12 },
  recurringSection: { marginTop: Spacing.xl, padding: Spacing.md, borderRadius: BorderRadius.xl, backgroundColor: 'rgba(0,0,0,0.02)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  stopBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: BorderRadius.md, borderWidth: 1 },
  stopBtnText: { fontSize: 14, fontWeight: '600' },
});
