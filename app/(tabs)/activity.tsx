/**
 * Activity Feed + Spending Analytics Screen
 */
import { EmptyState } from '@/components/EmptyState';
import { CategoryColors } from '@/constants/Colors';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/format';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    DeviceEventEmitter,
    Dimensions,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import {
    deleteExpense,
    getAllExpenses,
    getCurrentUser,
    getMonthlySpending,
    getSpendingByCategory,
    getTotalSpendingForMonth,
    updateUser,
    type CategorySpending,
    type Expense,
    type MonthlySpending,
    type User
} from '../../lib/database';

const SCREEN_WIDTH = Dimensions.get('window').width;
const currencySymbol = formatCurrency(0).replace(/[0-9.,\s]/g, '').trim() || '₹';

type Tab = 'feed' | 'stats';

const CATEGORY_PALETTE: Record<string, string> = {
  food: '#FF6B6B',
  transport: '#4ECDC4',
  accommodation: '#45B7D1',
  entertainment: '#FFA07A',
  shopping: '#DDA0DD',
  utilities: '#98D8C8',
  health: '#F7DC6F',
  travel: '#96CEB4',
  general: '#B0BEC5',
};

export default function ActivityScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('feed');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Analytics state
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [categoryData, setCategoryData] = useState<CategorySpending[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlySpending[]>([]);
  const [currentMonthTotal, setCurrentMonthTotal] = useState(0);
  const [prevMonthTotal, setPrevMonthTotal] = useState(0);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  const loadFeed = useCallback(async () => {
    try {
      setExpenses(await getAllExpenses());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteExpense = (exp: Expense) => {
    // Cancel any in-progress delete
    if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
    setPendingDeleteId(exp.id);
    pendingDeleteTimer.current = setTimeout(async () => {
      await deleteExpense(exp.id);
      setPendingDeleteId(null);
      loadData();
    }, 4000);
  };

  const handleUndoDelete = () => {
    if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
    setPendingDeleteId(null);
  };

  useEffect(() => () => {
    if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [cats, monthly, curr, prev, user] = await Promise.all([
        getSpendingByCategory(selectedMonth, selectedYear),
        getMonthlySpending(6),
        getTotalSpendingForMonth(selectedMonth, selectedYear),
        getTotalSpendingForMonth(
          selectedMonth === 1 ? 12 : selectedMonth - 1,
          selectedMonth === 1 ? selectedYear - 1 : selectedYear
        ),
        getCurrentUser(),
      ]);
      if (!user) throw new Error('No user found');
      setCategoryData(cats);
      setMonthlyData(monthly);
      setCurrentMonthTotal(curr);
      setPrevMonthTotal(prev);
      setCurrentUser(user);
      if (user.budget_amount) setBudgetInput(String(user.budget_amount));
    } catch (e) {
      setCurrentUser(null);
      Alert.alert('No User Found', 'No user exists in the app. Please sign in or create an account.');
    }
  }, [selectedMonth, selectedYear]);

  const loadData = useCallback(async () => {
    await Promise.all([loadFeed(), loadStats()]);
  }, [loadFeed, loadStats]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('sync_complete', loadData);
    return () => sub.remove();
  }, [loadData]);

  // Reload stats when month changes
  useEffect(() => { loadStats(); }, [selectedMonth, selectedYear]);

  const filteredExpenses = useMemo(() => {
    const base = expenses.filter(e => e.id !== pendingDeleteId);
    if (!searchQuery.trim()) return base;
    const query = searchQuery.toLowerCase();
    return base.filter(
      (e) =>
        e.description.toLowerCase().includes(query) ||
        e.group_name?.toLowerCase().includes(query) ||
        e.creator_name?.toLowerCase().includes(query) ||
        e.category.toLowerCase().includes(query)
    );
  }, [expenses, searchQuery, pendingDeleteId]);

  const grouped: Record<string, Expense[]> = {};
  filteredExpenses.forEach((e) => {
    const k = formatDate(e.created_at);
    (grouped[k] = grouped[k] || []).push(e);
  });

  const totalCategoryAmount = categoryData.reduce((s, c) => s + c.total, 0);
  const monthDiff = prevMonthTotal > 0
    ? Math.round(((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100)
    : null;

  const monthLabel = new Date(selectedYear, selectedMonth - 1, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const nextMonth = () => {
    const isCurrentMonth = selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();
    if (isCurrentMonth) return;
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const barChartData = {
    labels: monthlyData.map(m => m.label),
    datasets: [{ data: monthlyData.map(m => m.total || 0) }],
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Tab Toggle */}
      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['feed', 'stats'] as Tab[]).map(t => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[styles.tabBtn, tab === t && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
          >
            <Ionicons
              name={t === 'feed' ? 'receipt-outline' : 'bar-chart-outline'}
              size={16}
              color={tab === t ? colors.primary : colors.textTertiary}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.tabText, { color: tab === t ? colors.primary : colors.textTertiary }]}>
              {t === 'feed' ? 'Feed' : 'Insights'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* FEED TAB */}
      {tab === 'feed' && (
        <>
          <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
            <Ionicons name="search" size={20} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search expenses, groups, people..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await loadData(); setRefreshing(false); }} tintColor={colors.primary} />}
            showsVerticalScrollIndicator={false}
          >
            {Object.entries(grouped).map(([date, items], gi) => (
              <Animated.View key={date} entering={FadeInDown.delay(gi * 80).springify()}>
                <Text style={[styles.dateHead, { color: colors.textSecondary }]}>{date}</Text>
                <View style={[styles.card, { backgroundColor: colors.surface }]}>
                  {items.map((exp, i) => {
                    const cat = CategoryColors[exp.category] || CategoryColors.general;
                    const renderRightActions = () => (
                      <Pressable style={styles.deleteSwipeBtn} onPress={() => handleDeleteExpense(exp)}>
                        <Ionicons name="trash-outline" size={24} color="#FFF" />
                      </Pressable>
                    );
                    return (
                      <Swipeable key={exp.id} renderRightActions={renderRightActions} overshootRight={false}>
                        <Pressable
                          onPress={() => router.push(`/group/expense/${exp.id}`)}
                          style={[styles.row, i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}
                        >
                          <View style={[styles.icon, { backgroundColor: cat.color + '20' }]}>
                            <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                          </View>
                          <View style={styles.info}>
                            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{exp.description}</Text>
                            <Text style={[styles.meta, { color: colors.textTertiary }]}>
                              {exp.creator_name || 'You'} · {exp.group_name || 'group'}
                            </Text>
                          </View>
                          <View style={styles.right}>
                            <Text style={[styles.amt, { color: colors.text }]}>{formatCurrency(exp.amount)}</Text>
                            <Text style={[styles.time, { color: colors.textTertiary }]}>{formatRelativeTime(exp.created_at)}</Text>
                          </View>
                        </Pressable>
                      </Swipeable>
                    );
                  })}
                </View>
              </Animated.View>
            ))}
            {expenses.length === 0 && !loading && (
              <EmptyState icon="receipt-outline" title="No Activity Yet" subtitle="Expenses will appear here." />
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}

      {/* STATS TAB */}
      {tab === 'stats' && (
        <ScrollView
          contentContainerStyle={styles.statsScroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Month Picker */}
          <Animated.View entering={FadeIn.delay(50)} style={[styles.monthPicker, { backgroundColor: colors.surface }]}>
            <Pressable onPress={prevMonth} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
            </Pressable>
            <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
            <Pressable onPress={nextMonth} hitSlop={12}>
              <Ionicons
                name="chevron-forward"
                size={22}
                color={
                  selectedMonth === now.getMonth() + 1 && selectedYear === now.getFullYear()
                    ? colors.border
                    : colors.primary
                }
              />
            </Pressable>
          </Animated.View>

          {/* Summary Insight Cards */}
          <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.insightRow}>
            <View style={[styles.insightCard, { backgroundColor: colors.primary + '15', flex: 1.2 }]}>
              <Ionicons name="wallet-outline" size={20} color={colors.primary} />
              <Text style={[styles.insightValue, { color: colors.text }]}>{formatCurrency(currentMonthTotal)}</Text>
              <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>Your share this month</Text>
            </View>
            <View style={[styles.insightCard, {
              backgroundColor: monthDiff === null ? colors.surface : monthDiff > 0 ? '#FF6B6B15' : '#1CC29F15',
              flex: 0.8,
            }]}>
              <Ionicons
                name={monthDiff === null ? 'analytics-outline' : monthDiff > 0 ? 'trending-up-outline' : 'trending-down-outline'}
                size={20}
                color={monthDiff === null ? colors.textTertiary : monthDiff > 0 ? '#FF6B6B' : '#1CC29F'}
              />
              <Text style={[styles.insightValue, {
                color: monthDiff === null ? colors.textTertiary : monthDiff > 0 ? '#FF6B6B' : '#1CC29F',
              }]}>
                {monthDiff === null ? 'N/A' : `${monthDiff > 0 ? '+' : ''}${monthDiff}%`}
              </Text>
              <Text style={[styles.insightLabel, { color: colors.textSecondary }]}>vs last month</Text>
            </View>
          </Animated.View>

          {/* Budget Progress Card */}
          <Animated.View entering={FadeInDown.delay(125).springify()} style={[styles.chartCard, { backgroundColor: colors.surface }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md }}>
              <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Monthly Budget</Text>
              <Pressable onPress={() => {
                setEditingBudget(!editingBudget);
                if (editingBudget && budgetInput) {
                  const amt = parseFloat(budgetInput);
                  if (amt > 0 && currentUser) {
                    updateUser(currentUser.id, { budget_amount: amt });
                    setCurrentUser({ ...currentUser, budget_amount: amt });
                  }
                }
              }}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
                  {editingBudget ? 'Save' : (currentUser?.budget_amount ? 'Edit' : 'Set Budget')}
                </Text>
              </Pressable>
            </View>
            {editingBudget ? (
              <View style={[styles.budgetInputRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>{currencySymbol}</Text>
                <TextInput
                  style={[styles.budgetInput, { color: colors.text }]}
                  placeholder="e.g. 15000"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  value={budgetInput}
                  onChangeText={setBudgetInput}
                  autoFocus
                />
              </View>
            ) : currentUser?.budget_amount ? (() => {
              const budget = currentUser.budget_amount;
              const pct = Math.min((currentMonthTotal / budget) * 100, 100);
              const barColor = pct >= 100 ? '#FF3B30' : pct >= 80 ? '#FF9500' : colors.primary;
              const remaining = Math.max(budget - currentMonthTotal, 0);
              return (
                <>
                  <View style={styles.budgetSummaryRow}>
                    <Text style={[styles.budgetSpent, { color: colors.text }]}>
                      {formatCurrency(currentMonthTotal)}
                    </Text>
                    <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
                      of {formatCurrency(budget)}
                    </Text>
                  </View>
                  <View style={[styles.budgetBarTrack, { backgroundColor: colors.borderLight }]}>
                    <View style={[styles.budgetBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={{ color: barColor, fontSize: 13, fontWeight: '700' }}>
                      {pct.toFixed(0)}% used
                    </Text>
                    <Text style={{ color: remaining > 0 ? colors.primary : '#FF3B30', fontSize: 13, fontWeight: '600' }}>
                      {remaining > 0 ? `${formatCurrency(remaining)} remaining` : 'Over budget!'}
                    </Text>
                  </View>
                  {pct >= 80 && pct < 100 && (
                    <View style={[styles.budgetAlert, { backgroundColor: '#FF950015', borderColor: '#FF950030' }]}>
                      <Ionicons name="warning-outline" size={16} color="#FF9500" />
                      <Text style={{ color: '#FF9500', fontSize: 13, fontWeight: '600', flex: 1 }}>
                        You've used {pct.toFixed(0)}% of your budget. Slow down!
                      </Text>
                    </View>
                  )}
                  {pct >= 100 && (
                    <View style={[styles.budgetAlert, { backgroundColor: '#FF3B3015', borderColor: '#FF3B3030' }]}>
                      <Ionicons name="alert-circle-outline" size={16} color="#FF3B30" />
                      <Text style={{ color: '#FF3B30', fontSize: 13, fontWeight: '600', flex: 1 }}>
                        Budget exceeded! You're over by {formatCurrency(currentMonthTotal - budget)}.
                      </Text>
                    </View>
                  )}
                </>
              );
            })() : (
              <View style={{ alignItems: 'center', paddingVertical: Spacing.lg }}>
                <Ionicons name="wallet-outline" size={32} color={colors.textTertiary} />
                <Text style={{ color: colors.textTertiary, fontSize: 14, marginTop: 8 }}>
                  Set a monthly budget to track spending
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Monthly Bar Chart */}
          {monthlyData.some(m => m.total > 0) && (
            <Animated.View entering={FadeInDown.delay(150).springify()} style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>6-Month Trend</Text>
              <BarChart
                data={barChartData}
                width={SCREEN_WIDTH - Spacing.base * 4}
                height={180}
                yAxisLabel={currencySymbol}
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 0,
                  color: (opacity = 1) => `rgba(28, 194, 159, ${opacity})`,
                  labelColor: () => colors.textTertiary,
                  style: { borderRadius: 8 },
                  propsForBackgroundLines: { strokeDasharray: '', stroke: colors.borderLight },
                  barPercentage: 0.6,
                }}
                style={{ borderRadius: 8, marginLeft: -16 }}
                showValuesOnTopOfBars={false}
                withInnerLines={true}
                fromZero
              />
            </Animated.View>
          )}

          {/* Category Breakdown */}
          {categoryData.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(200).springify()} style={[styles.chartCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>By Category</Text>
              {categoryData.map((cat, i) => {
                const pct = totalCategoryAmount > 0 ? (cat.total / totalCategoryAmount) * 100 : 0;
                const catColor = CATEGORY_PALETTE[cat.category] || CATEGORY_PALETTE.general;
                const catInfo = CategoryColors[cat.category] || CategoryColors.general;
                return (
                  <Animated.View key={cat.category} entering={FadeInDown.delay(200 + i * 60).springify()}>
                    <View style={styles.catRow}>
                      <View style={[styles.catDot, { backgroundColor: catColor }]} />
                      <View style={[styles.catIconBox, { backgroundColor: catColor + '20' }]}>
                        <Ionicons name={catInfo.icon as any} size={14} color={catColor} />
                      </View>
                      <Text style={[styles.catName, { color: colors.text }]}>
                        {cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}
                      </Text>
                      <Text style={[styles.catPct, { color: colors.textSecondary }]}>{pct.toFixed(0)}%</Text>
                      <Text style={[styles.catAmt, { color: colors.text }]}>{formatCurrency(cat.total)}</Text>
                    </View>
                    <View style={[styles.barTrack, { backgroundColor: colors.borderLight }]}>
                      <Animated.View
                        style={[styles.barFill, { width: `${pct}%`, backgroundColor: catColor }]}
                      />
                    </View>
                  </Animated.View>
                );
              })}
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <EmptyState
                icon="bar-chart-outline"
                title="No Spending Data"
                subtitle="Add expenses to see your spending breakdown."
              />
            </Animated.View>
          )}

          {/* Top Insight */}
          {categoryData.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300).springify()} style={[styles.tipCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
              <Ionicons name="bulb-outline" size={20} color={colors.primary} style={{ marginBottom: 6 }} />
              <Text style={[styles.tipText, { color: colors.text }]}>
                💡 You spent the most on{' '}
                <Text style={{ fontWeight: '800', color: colors.primary }}>
                  {categoryData[0].category.charAt(0).toUpperCase() + categoryData[0].category.slice(1)}
                </Text>{' '}
                ({formatCurrency(categoryData[0].total)}) this month
                {categoryData[0].total > 0 && totalCategoryAmount > 0
                  ? ` — ${Math.round((categoryData[0].total / totalCategoryAmount) * 100)}% of your total spending.`
                  : '.'}
              </Text>
            </Animated.View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Undo Toast */}
      {pendingDeleteId && (
        <Pressable
          onPress={handleUndoDelete}
          style={[styles.undoToast, { backgroundColor: colors.text }]}
        >
          <Text style={[styles.undoToastText, { color: colors.background }]}>Expense deleted</Text>
          <Text style={[styles.undoToastAction, { color: colors.primary }]}>UNDO</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.base,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  tabText: { fontSize: 14, fontWeight: '700' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.base,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, padding: 0 },
  scroll: { padding: Spacing.base, paddingTop: 0 },
  dateHead: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
    marginLeft: 4,
  },
  card: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.base, gap: 12 },
  icon: { width: 42, height: 42, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  meta: { fontSize: 13 },
  right: { alignItems: 'flex-end', justifyContent: 'center' },
  amt: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  time: { fontSize: 12 },
  deleteSwipeBtn: { backgroundColor: '#FF3B30', justifyContent: 'center', alignItems: 'center', width: 70 },

  // Stats styles
  statsScroll: { padding: Spacing.base, paddingBottom: 100 },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  monthLabel: { fontSize: 16, fontWeight: '700' },
  insightRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.lg },
  insightCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'flex-start',
    gap: 4,
  },
  insightValue: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  insightLabel: { fontSize: 12, fontWeight: '500' },
  chartCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.md },
  catRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catIconBox: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  catName: { flex: 1, fontSize: 14, fontWeight: '600' },
  catPct: { fontSize: 12, fontWeight: '500', width: 36, textAlign: 'right' },
  catAmt: { fontSize: 14, fontWeight: '700', width: 72, textAlign: 'right' },
  barTrack: { height: 6, borderRadius: 3, marginBottom: Spacing.md, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  tipCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  tipText: { fontSize: 14, lineHeight: 22 },
  undoToast: {
    position: 'absolute',
    bottom: 100,
    left: Spacing.base,
    right: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  undoToastText: { fontSize: 14, fontWeight: '500' },
  undoToastAction: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  budgetInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  budgetInput: { flex: 1, fontSize: 22, fontWeight: '800', padding: 0 },
  budgetSummaryRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  budgetSpent: { fontSize: 24, fontWeight: '800' },
  budgetBarTrack: { height: 10, borderRadius: 5, overflow: 'hidden' },
  budgetBarFill: { height: 10, borderRadius: 5 },
  budgetAlert: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: 12 },
});
