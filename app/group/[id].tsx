/**
 * Group Detail Screen
 */
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { FAB } from '@/components/FAB';
import { CategoryColors, GroupCategoryColors } from '@/constants/Colors';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/format';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useState } from 'react';
import { Alert, DeviceEventEmitter, Linking, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    calculateGroupBalances,
    deleteExpense, deleteGroup,
    getCurrentUser,
    getExpenseDetailsForGroup,
    getGroup,
    getGroupExpenses,
    getGroupMembers,
    getSimplifiedDebts,
    type Balance, type DebtEdge,
    type Expense,
    type Group, type User
} from '../../lib/database';

type Tab = 'expenses' | 'balances';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const router = useRouter();

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [debts, setDebts] = useState<DebtEdge[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>('expenses');
  const [refreshing, setRefreshing] = useState(false);
  const [expenseDetails, setExpenseDetails] = useState<Record<string, { iPaid: number; myShare: number }>>({});

  const load = useCallback(async () => {
    if (!id) return;
    const [g, m, e, b, d, cu] = await Promise.all([
      getGroup(id), getGroupMembers(id), getGroupExpenses(id),
      calculateGroupBalances(id), getSimplifiedDebts(id), getCurrentUser(),
    ]);
    setGroup(g);
    setMembers(m);
    setExpenses(e);
    setBalances(b);
    setDebts(d);
    setCurrentUser(cu);

    // Batch-load all payers and shares in two queries instead of N*2
    const { payersByExpense, sharesByExpense } = await getExpenseDetailsForGroup(id);
    const details: Record<string, { iPaid: number; myShare: number }> = {};
    for (const exp of e) {
      const myPaid = (payersByExpense[exp.id] ?? []).find(p => p.user_id === cu?.id)?.amount || 0;
      const myShare = (sharesByExpense[exp.id] ?? []).find(s => s.user_id === cu?.id)?.share_amount || 0;
      details[exp.id] = { iPaid: myPaid, myShare };
    }
    setExpenseDetails(details);
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener('sync_complete', load);
    return () => sub.remove();
  }, [load]);

  const myBalance = balances.find(b => b.userId === currentUser?.id);
  const groupCurrency = expenses.length > 0 ? expenses[0].currency || 'INR' : 'INR';
  const cat = GroupCategoryColors[group?.category || 'other'] || GroupCategoryColors.other;

  const handleDeleteGroup = () => {
    Haptics.selectionAsync();
    Alert.alert('Delete Group', 'This will delete all expenses. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteGroup(id!); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.back(); } },
    ]);
  };

  const handleDeleteExpense = (expId: string) => {
    Alert.alert('Delete Expense', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteExpense(expId);
        load();
      }}
    ]);
  };

  const exportCSV = async () => {
    if (!group) return;
    try {
      const header = 'Date,Description,Amount,Currency,Category,Paid By,Added By\n';
      const rows = expenses.map(e => {
        const creator = e.creator_name || 'You';
        return `"${formatDate(e.created_at)}","${e.description}",${e.amount},${e.currency},${e.category},"${creator}","${creator}"`;
      }).join('\n');
      const csv = header + rows;
      
      const fileUri = FileSystem.documentDirectory + `${group.name.replace(/\s+/g, '_')}_Expenses.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { dialogTitle: 'Export Group Expenses' });
    } catch (e) {
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const handleUPIPayment = async (toUser: User, amount: number) => {
    if (!toUser.upi_id) {
      Alert.alert('No UPI ID', `${toUser.name} hasn't added their UPI ID yet.`);
      return;
    }
    
    const upiUrl = `upi://pay?pa=${toUser.upi_id}&pn=${encodeURIComponent(toUser.name)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Splitmaro Settlement')}`;
    
    try {
      const supported = await Linking.canOpenURL(upiUrl);
      if (supported) {
        await Linking.openURL(upiUrl);
        Alert.alert('Mark as Settled?', 'Once you complete the payment, would you like to record this settlement in the app?', [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Yes, Record it', onPress: () => router.push({ 
            pathname: '/group/settle', 
            params: { groupId: id, fromId: currentUser?.id, toId: toUser.id, amount: String(amount), currency: groupCurrency } 
          }) }
        ]);
      } else {
        Alert.alert('No UPI App', 'Could not find any UPI apps to handle this payment.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to open payment app');
    }
  };

  const handleShare = async () => {
    if (!group) return;
    let msg = `Balances for ${group.name}\n\n`;
    const sorted = [...balances].sort((a, b) => b.amount - a.amount);
    sorted.forEach(m => {
      if (Math.abs(m.amount) > 0.01) {
        msg += `${m.userName}: ${m.amount > 0 ? 'Gets back' : 'Owes'} ${formatCurrency(Math.abs(m.amount), groupCurrency)}\n`;
      }
    });
    msg += `\nTracked with Splitmaro app.`;
    
    try {
      await Share.share({ message: msg });
    } catch (e) {
      console.error(e);
    }
  };

  const handleInvite = () => {
    if (!group) return;
    Haptics.selectionAsync();
    router.push({
      pathname: '/group/invite' as any,
      params: { groupId: group.id }
    });
  };

  if (!group) return <View style={[styles.root, { backgroundColor: colors.background }]} />;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerEmoji}>{cat.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{group.name}</Text>
            {group.created_by && (
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>
                Admin: {members.find(m => m.id === group.created_by)?.name || (group.created_by === currentUser?.id ? 'You' : 'Loading...')}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={handleInvite} hitSlop={12} style={{ marginRight: 16 }}>
            <Ionicons name="person-add-outline" size={22} color={colors.primary} />
          </Pressable>
          <Pressable onPress={handleShare} hitSlop={12} style={{ marginRight: 16 }}>
            <Ionicons name="share-outline" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={exportCSV} hitSlop={12} style={{ marginRight: 16 }}>
            <Ionicons name="download-outline" size={20} color={colors.textSecondary} />
          </Pressable>
          <Pressable 
            onPress={() => {
              Alert.alert(group.name, 'Group options', [
                { text: 'Delete Group', style: 'destructive', onPress: handleDeleteGroup },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }} 
            hitSlop={12}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Balance Banner */}
      <View style={[styles.banner, { backgroundColor: colors.surface }]}>
        <View style={styles.bannerRow}>
          <View>
            <Text style={[styles.bannerLabel, { color: colors.textSecondary }]}>Your Balance</Text>
            <Text style={[styles.bannerAmount, {
              color: !myBalance || Math.abs(myBalance.amount) < 0.01 ? colors.textTertiary : myBalance.amount > 0 ? colors.primary : colors.negative
            }]}>
              {!myBalance || Math.abs(myBalance.amount) < 0.01
                ? 'Settled up ✓'
                : `${myBalance.amount > 0 ? '+' : '-'}${formatCurrency(Math.abs(myBalance.amount), groupCurrency)}`}
            </Text>
          </View>
          <Pressable style={styles.membersRow} onPress={() => router.push({ pathname: '/group/members', params: { groupId: group.id } })}>
            {members.slice(0, 4).map((m, i) => (
              <View key={m.id} style={[styles.miniAvatar, { marginLeft: i > 0 ? -8 : 0 }]}>
                <Avatar name={m.name} color={m.avatar_color} size={28} fontSize={10} avatarUrl={m.avatar_url} />
              </View>
            ))}
            {members.length > 4 && (
              <View style={[styles.miniAvatar, { marginLeft: -8, backgroundColor: colors.surfaceSecondary, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}>+{members.length - 4}</Text>
              </View>
            )}
            <View style={[styles.miniAvatar, { marginLeft: -8, backgroundColor: colors.surface, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderLight, borderStyle: 'dashed' }]}>
              <Ionicons name="add" size={16} color={colors.textSecondary} />
            </View>
          </Pressable>
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['expenses', 'balances'] as Tab[]).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}>
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.textTertiary }]}>
              {t === 'expenses' ? `Expenses (${expenses.length})` : 'Balances'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await require('@/lib/sync').pullFromCloud();
              } catch (e) {
                console.warn('[GroupDetail] Pull to refresh cloud sync failed:', e);
              }
              await load();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {tab === 'expenses' && (
          <>
            {expenses.map((exp, i) => {
              const catC = CategoryColors[exp.category] || CategoryColors.general;
              const det = expenseDetails[exp.id] || { iPaid: 0, myShare: 0 };
              const net = det.iPaid - det.myShare;
              
              const renderRightActions = () => (
                <Pressable style={styles.deleteSwipeBtn} onPress={() => handleDeleteExpense(exp.id)}>
                  <Ionicons name="trash-outline" size={24} color="#FFF" />
                </Pressable>
              );

              return (
                <Animated.View key={exp.id} entering={FadeInDown.delay(i * 50).springify()}>
                  <Swipeable renderRightActions={renderRightActions} overshootRight={false} containerStyle={{ marginBottom: 12 }}>
                    <Pressable onPress={() => router.push(`/group/expense/${exp.id}`)} style={[styles.expRow, { backgroundColor: colors.surface }]}>
                      <View style={[styles.expIcon, { backgroundColor: catC.color + '20' }]}>
                        <Ionicons name={catC.icon as any} size={20} color={catC.color} />
                      </View>
                      <View style={styles.expInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={[styles.expTitle, { color: colors.text }]} numberOfLines={1}>{exp.description}</Text>
                          {!!exp.receipt_uri && (
                            <Ionicons name="attach-outline" size={14} color={colors.textSecondary} style={{ marginLeft: 2 }} />
                          )}
                          {!!exp.is_recurring_parent && (
                            <View style={[styles.recurringBadge, { backgroundColor: colors.primary + '20' }]}>
                              <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>🔁</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.expMeta, { color: colors.textTertiary }]}>
                          {exp.creator_name || 'You'} paid {formatCurrency(exp.amount, exp.currency || 'INR')} · {formatRelativeTime(exp.created_at)}
                        </Text>
                      </View>
                      <View style={styles.expRight}>
                        {Math.abs(net) > 0.01 ? (
                          <>
                            <Text style={[styles.expLabel, { color: net > 0 ? colors.primary : colors.negative }]}>{net > 0 ? 'you lent' : 'you owe'}</Text>
                            <Text style={[styles.expAmt, { color: net > 0 ? colors.primary : colors.negative }]}>{formatCurrency(Math.abs(net), exp.currency || 'INR')}</Text>
                          </>
                        ) : (
                          <Text style={[styles.expLabel, { color: colors.textTertiary }]}>not involved</Text>
                        )}
                      </View>
                    </Pressable>
                  </Swipeable>
                </Animated.View>
              );
            })}
            {expenses.length === 0 && (
              <EmptyState icon="receipt-outline" title="No Expenses" subtitle="Add an expense to start tracking." actionLabel="Add Expense" onAction={() => router.push({ pathname: '/group/add-expense', params: { groupId: id } })} />
            )}
          </>
        )}

        {tab === 'balances' && (
          <>
            {/* Per-member balances */}
            <Text style={[styles.secTitle, { color: colors.text }]}>Member Balances</Text>
            <Card variant="default" padding={0} style={{ marginBottom: 16 }}>
              {balances.map((b, i) => (
                <View key={b.userId} style={[styles.balRow, i < balances.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                  <Avatar name={b.userName} color={b.avatarColor} size={36} fontSize={12} avatarUrl={b.avatarUrl} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{b.userName}</Text>
                    {b.userEmail && <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{b.userEmail}</Text>}
                  </View>
                  <Text style={[styles.balAmt, { color: Math.abs(b.amount) < 0.01 ? colors.textTertiary : b.amount > 0 ? colors.primary : colors.negative }]}>
                    {Math.abs(b.amount) < 0.01 ? 'settled' : `${b.amount > 0 ? '+' : '-'}${formatCurrency(Math.abs(b.amount), groupCurrency)}`}
                  </Text>
                </View>
              ))}
            </Card>

            {/* Simplified debts */}
            {debts.length > 0 && (
              <>
                <Text style={[styles.secTitle, { color: colors.text }]}>Suggested Settlements</Text>
                {debts.map((d, i) => {
                  const isIOWE = currentUser?.id === d.from.id;
                  return (
                    <Animated.View key={i} entering={FadeInDown.delay(i * 80).springify()}>
                      <Card variant="outlined" style={{ marginBottom: 8 }}>
                        <View style={styles.debtRow}>
                          <Avatar name={d.from.name} color={d.from.avatar_color} size={32} fontSize={11} avatarUrl={d.from.avatar_url} />
                          <View style={styles.debtInfo}>
                            <Text style={[styles.debtText, { color: colors.text }]}>
                              <Text style={{ fontWeight: '700' }}>{d.from.name}</Text> pays{' '}
                              <Text style={{ fontWeight: '700' }}>{d.to.name}</Text>
                            </Text>
                            <Text style={[styles.debtAmt, { color: colors.primary }]}>{formatCurrency(d.amount, groupCurrency)}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {isIOWE && d.to.upi_id && (
                              <Pressable
                                style={[styles.upiBtn, { borderColor: colors.primary }]}
                                onPress={() => handleUPIPayment(d.to, d.amount)}
                              >
                                <Ionicons name="flash" size={16} color={colors.primary} />
                                <Text style={[styles.upiBtnText, { color: colors.primary }]}>Pay</Text>
                              </Pressable>
                            )}
                            <Pressable
                              style={[styles.settleBtn, { backgroundColor: colors.primary }]}
                              onPress={() => router.push({ pathname: '/group/settle', params: { groupId: id, fromId: d.from.id, toId: d.to.id, amount: String(d.amount), currency: groupCurrency } })}
                            >
                              <Text style={styles.settleBtnText}>Settle</Text>
                            </Pressable>
                          </View>
                        </View>
                      </Card>
                    </Animated.View>
                  );
                })}
              </>
            )}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <FAB
        onPress={() => router.push({ pathname: '/group/add-expense', params: { groupId: id } })}
        icon="add"
        label="Add Expense"
        color={colors.primary}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, gap: 12 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerEmoji: { fontSize: 22 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  shareBtn: { alignItems: 'center', justifyContent: 'center' },
  shareText: { fontSize: 10, marginTop: 2 },
  banner: { marginHorizontal: Spacing.base, borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.md },
  bannerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  bannerAmount: { fontSize: 22, fontWeight: '800' },
  membersRow: { flexDirection: 'row', alignItems: 'center' },
  miniAvatar: { borderWidth: 2, borderColor: 'transparent', borderRadius: 16 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: Spacing.base },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabText: { fontSize: 14, fontWeight: '600' },
  scroll: { padding: Spacing.base },
  expRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: BorderRadius.md, gap: 12 },
  expIcon: { width: 42, height: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  expInfo: { flex: 1 },
  expTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  expMeta: { fontSize: 12 },
  expRight: { alignItems: 'flex-end' },
  expLabel: { fontSize: 11, fontWeight: '500', marginBottom: 1 },
  expAmt: { fontSize: 15, fontWeight: '700' },
  deleteSwipeBtn: { backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', width: 70, borderRadius: BorderRadius.md, marginLeft: 6 },
  secTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, marginTop: 4 },
  balRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  balName: { flex: 1, fontSize: 15, fontWeight: '600' },
  balAmt: { fontSize: 15, fontWeight: '700' },
  debtRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  debtInfo: { flex: 1 },
  debtText: { fontSize: 14 },
  debtAmt: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  settleBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.xl },
  settleBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  upiBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.xl, borderWidth: 1.5 },
  upiBtnText: { fontSize: 13, fontWeight: '700' },
  recurringBadge: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
});
