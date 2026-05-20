import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addGroupMember, calculateGroupBalances, getAllFriends, getExpensePayers, getExpenseShares, getGroup, getGroupExpenses, getGroupMembers, removeGroupMember, updateExpense, type Group, type User } from '../../lib/database';

export default function GroupMembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const colors = useThemeColors();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Split Options Modal State
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitType, setSplitType] = useState<'none' | 'auto' | 'percentage' | 'amount'>('none');
  const [splitValue, setSplitValue] = useState('10'); // Default 10% or $10

  const loadData = async () => {
    setLoading(true);
    try {
      const [g, m, f] = await Promise.all([
        getGroup(groupId!),
        getGroupMembers(groupId!),
        getAllFriends()
      ]);
      setGroup(g);
      setMembers(m);
      setFriends(f);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [groupId]);

  const handleAddMember = (friend: User) => {
    setSelectedFriend(friend);
    setSplitType('none');
    setSplitValue('10');
    setShowSplitModal(true);
  };

  const processAddMember = async () => {
    if (!selectedFriend) return;
    setShowSplitModal(false);
    setLoading(true);
    try {
      await addGroupMember(groupId!, selectedFriend.id);
      
      if (splitType !== 'none') {
        const expenses = await getGroupExpenses(groupId!);
        const val = parseFloat(splitValue) || 0;

        for (const exp of expenses) {
          const payers = await getExpensePayers(exp.id);
          const shares = await getExpenseShares(exp.id);
          
          let newShares = [...shares.map(s => ({ userId: s.user_id, shareAmount: s.share_amount }))];
          
          if (splitType === 'auto') {
            const newMemberCount = shares.length + 1;
            const newShareAmount = Math.round((exp.amount / newMemberCount) * 100) / 100;
            newShares = newShares.map(s => ({ ...s, shareAmount: newShareAmount }));
            newShares.push({ userId: selectedFriend.id, shareAmount: newShareAmount });
          } else if (splitType === 'percentage') {
            const shareAmount = Math.round((exp.amount * (val / 100)) * 100) / 100;
            newShares.push({ userId: selectedFriend.id, shareAmount });
            // Reduce others equally or proportionally (simplified: we just let the total shares exceed amount and Splitwise logic handles normalized % or we adjust others)
            // For Vibhag, if shares don't match total exactly, we should ideally adjust others.
            // Let's just adjust everyone else proportionally.
            const remaining = exp.amount - shareAmount;
            const originalTotal = exp.amount;
            newShares = newShares.map(s => {
              if (s.userId === selectedFriend.id) return s;
              return { ...s, shareAmount: Math.round((s.shareAmount / originalTotal) * remaining * 100) / 100 };
            });
          } else if (splitType === 'amount') {
            const shareAmount = val;
            newShares.push({ userId: selectedFriend.id, shareAmount });
            const remaining = exp.amount - shareAmount;
            const originalTotal = exp.amount;
            newShares = newShares.map(s => {
              if (s.userId === selectedFriend.id) return s;
              return { ...s, shareAmount: Math.round((s.shareAmount / originalTotal) * remaining * 100) / 100 };
            });
          }

          await updateExpense(exp.id, {
            groupId: exp.group_id,
            payers: payers.map(p => ({ userId: p.user_id, amount: p.amount })),
            shares: newShares
          });
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      loadData();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to add member and update expenses.');
      setLoading(false);
    }
  };

  const handleRemoveMember = async (member: User) => {
    if (member.is_current_user) {
      Alert.alert('Error', 'You cannot remove yourself from the group.');
      return;
    }

    setLoading(true);
    try {
      const groupBalances = await calculateGroupBalances(groupId!);
      const memberBalance = groupBalances.find(b => b.userId === member.id);
      const balanceAmt = memberBalance ? memberBalance.amount : 0;

      if (Math.abs(balanceAmt) > 0.01) {
        setLoading(false);
        const formattedAmt = Math.abs(balanceAmt).toFixed(2);
        const message = balanceAmt > 0
          ? `${member.name} is still owed ₹${formattedAmt} in this group. Settle their balance before removing them.`
          : `${member.name} still owes ₹${formattedAmt} in this group. Settle their balance before removing them.`;
        
        Alert.alert('Cannot Remove Member', message, [
          { text: 'OK' },
          {
            text: 'Settle Now',
            onPress: () => {
              router.push({
                pathname: '/group/settle',
                params: {
                  groupId,
                  fromId: balanceAmt < 0 ? member.id : undefined,
                  toId: balanceAmt > 0 ? member.id : undefined,
                  amount: formattedAmt
                }
              });
            }
          }
        ]);
        return;
      }

      setLoading(false);
      Alert.alert(
        'Remove Member',
        `Remove ${member.name} from the group?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              setLoading(true);
              try {
                await removeGroupMember(groupId!, member.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                await loadData();
              } catch (err) {
                Alert.alert('Error', 'Failed to remove member.');
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to verify member balances.');
      setLoading(false);
    }
  };

  const nonMembers = friends.filter(f => !members.find(m => m.id === f.id));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Members</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>CURRENT MEMBERS</Text>
        <Card variant="default" padding={0}>
          {members.map((m, i) => {
            const isAdmin = group?.created_by === m.id;
            return (
              <View key={m.id} style={[styles.row, i < members.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <Avatar name={m.name} color={m.avatar_color} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{m.is_current_user ? 'You' : m.name}</Text>
                  {m.email && <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{m.email}</Text>}
                  {isAdmin && (
                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700', marginTop: 4 }}>
                      👑 Creator / Admin
                    </Text>
                  )}
                </View>
                {!m.is_current_user && !isAdmin && (
                  <Pressable onPress={() => handleRemoveMember(m)} hitSlop={10}>
                    <Ionicons name="person-remove" size={20} color={colors.negative} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>

        {nonMembers.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: Spacing.xl }]}>ADD FRIENDS TO GROUP</Text>
            <Card variant="default" padding={0}>
              {nonMembers.map((f, i) => (
                <Pressable
                  key={f.id}
                  onPress={() => handleAddMember(f)}
                  style={[styles.row, i < nonMembers.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                >
                  <Avatar name={f.name} color={f.avatar_color} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{f.name}</Text>
                    {f.email && <Text style={{ fontSize: 13, color: colors.textTertiary, marginTop: 2 }}>{f.email}</Text>}
                  </View>
                  <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                </Pressable>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      {/* Split Options Modal */}
      {showSplitModal && selectedFriend && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add {selectedFriend.name}</Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>Include in past expenses?</Text>

            <Pressable onPress={() => setSplitType('none')} style={[styles.optionRow, splitType === 'none' && { borderColor: colors.primary, backgroundColor: colors.primary + '11' }]}>
              <Ionicons name={splitType === 'none' ? "radio-button-on" : "radio-button-off"} size={20} color={splitType === 'none' ? colors.primary : colors.textTertiary} />
              <Text style={[styles.optionText, { color: colors.text }]}>No, just add to group</Text>
            </Pressable>

            <Pressable onPress={() => setSplitType('auto')} style={[styles.optionRow, splitType === 'auto' && { borderColor: colors.primary, backgroundColor: colors.primary + '11' }]}>
              <Ionicons name={splitType === 'auto' ? "radio-button-on" : "radio-button-off"} size={20} color={splitType === 'auto' ? colors.primary : colors.textTertiary} />
              <Text style={[styles.optionText, { color: colors.text }]}>Auto (Equal Share)</Text>
            </Pressable>

            <Pressable onPress={() => setSplitType('percentage')} style={[styles.optionRow, splitType === 'percentage' && { borderColor: colors.primary, backgroundColor: colors.primary + '11' }]}>
              <Ionicons name={splitType === 'percentage' ? "radio-button-on" : "radio-button-off"} size={20} color={splitType === 'percentage' ? colors.primary : colors.textTertiary} />
              <Text style={[styles.optionText, { color: colors.text }]}>Percentage (%)</Text>
            </Pressable>

            <Pressable onPress={() => setSplitType('amount')} style={[styles.optionRow, splitType === 'amount' && { borderColor: colors.primary, backgroundColor: colors.primary + '11' }]}>
              <Ionicons name={splitType === 'amount' ? "radio-button-on" : "radio-button-off"} size={20} color={splitType === 'amount' ? colors.primary : colors.textTertiary} />
              <Text style={[styles.optionText, { color: colors.text }]}>Fixed Amount (₹)</Text>
            </Pressable>

            {(splitType === 'percentage' || splitType === 'amount') && (
              <View style={styles.inputContainer}>
                <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
                  {splitType === 'percentage' ? 'Percentage (e.g. 10)' : 'Amount (e.g. 100)'}
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  value={splitValue}
                  onChangeText={setSplitValue}
                  keyboardType="numeric"
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowSplitModal(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={processAddMember} style={[styles.modalBtn, { backgroundColor: colors.primary, borderRadius: 8 }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Add Member</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  scroll: { padding: Spacing.base },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: 12 },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalContent: { width: '100%', borderRadius: BorderRadius.xl, padding: Spacing.xl },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  modalSub: { fontSize: 14, marginBottom: 16 },
  optionRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'transparent', marginBottom: 8, gap: 12 },
  optionText: { fontSize: 15, fontWeight: '600' },
  inputContainer: { marginTop: 8, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: 12, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 12 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 16 }
});
