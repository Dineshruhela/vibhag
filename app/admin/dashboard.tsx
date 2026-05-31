/**
 * Splitmaro Premium Admin Dashboard Screen
 */
import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { apiRequest } from '@/lib/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type Purchase = {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  created_at: number;
  user: { name: string; email: string; avatar_color: string; } | null;
};

type Stats = {
  totalUsers: number;
  activeUsers: number;
  deactivatedUsers: number;
  proUsers: number;
  totalReferrals: number;
  totalGroups: number;
  totalExpenses: number;
  totalRevenue: number;
  purchases: Purchase[];
};

type AdminUser = {
  id: string;
  name: string;
  email: string | null;
  avatar_color: string;
  avatar_url: string | null;
  is_pro: number;
  is_admin: number;
  is_active: number;
  created_at: number;
  group_count: number;
  friend_count: number;
  purchase_count: number;
};

type AdminGroup = {
  id: string;
  name: string;
  category: string;
  created_by: string;
  created_at: number;
  updated_at: number;
  member_count: number;
  expense_count: number;
  settlement_count: number;
};

export default function AdminDashboardScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'groups' | 'settings'>('overview');

  // Stats Data
  const [stats, setStats] = useState<Stats | null>(null);

  // Settings Data
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('');
  const [updatingConfig, setUpdatingConfig] = useState(false);

  // Users Data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');

  // Groups Data
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [groupSearch, setGroupSearch] = useState('');

  const fetchStats = async () => {
    const data = await apiRequest('/api/admin/stats');
    if (data) setStats(data);
  };

  const fetchConfig = async () => {
    const config = await apiRequest('/api/payment/config');
    if (config) {
      setPrice(String(config.amount));
      setCurrency(config.currency);
    }
  };

  const fetchUsers = async () => {
    const query = new URLSearchParams({ search: userSearch, filter: userFilter }).toString();
    const data = await apiRequest(`/api/admin/users?${query}`);
    if (data && data.users) setUsers(data.users);
  };

  const fetchGroups = async () => {
    const query = new URLSearchParams({ search: groupSearch }).toString();
    const data = await apiRequest(`/api/admin/groups?${query}`);
    if (data && data.groups) setGroups(data.groups);
  };

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      if (activeTab === 'overview') await fetchStats();
      else if (activeTab === 'settings') await fetchConfig();
      else if (activeTab === 'users') await fetchUsers();
      else if (activeTab === 'groups') await fetchGroups();
    } catch (e: any) {
      console.error('[AdminDashboard] Failed to fetch data:', e);
      Alert.alert('Access Denied', e.message || 'Only administrators can access the console.');
      router.back();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [activeTab]);
  useEffect(() => { if (activeTab === 'users') fetchUsers(); }, [userSearch, userFilter]);
  useEffect(() => { if (activeTab === 'groups') fetchGroups(); }, [groupSearch]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData(false);
  };

  // --- ACTIONS ---

  const handleSavePricing = async () => {
    const parsedPrice = Number(price);
    if (isNaN(parsedPrice) || parsedPrice < 1) return Alert.alert('Invalid Price', 'Price must be >= 1.');
    const cleanCurrency = currency.trim().toUpperCase();
    if (!cleanCurrency || cleanCurrency.length > 5) return Alert.alert('Invalid Currency', 'Currency code must be 1-5 chars.');

    setUpdatingConfig(true);
    try {
      await apiRequest('/api/admin/config', { method: 'POST', body: JSON.stringify({ amount: parsedPrice, currency: cleanCurrency }) });
      Alert.alert('Success', 'Pricing updated successfully!');
    } catch (e: any) {
      Alert.alert('Update Failed', e.message);
    } finally {
      setUpdatingConfig(false);
    }
  };

  const handleTogglePro = async (user: AdminUser) => {
    try {
      await apiRequest(`/api/admin/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ is_pro: user.is_pro ? 0 : 1 }) });
      fetchUsers();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleToggleAdmin = async (user: AdminUser) => {
    try {
      await apiRequest(`/api/admin/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ is_admin: user.is_admin ? 0 : 1 }) });
      fetchUsers();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      if (user.is_active) {
        Alert.alert('Deactivate User', `Are you sure you want to deactivate ${user.name}?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Deactivate', style: 'destructive', onPress: async () => {
              await apiRequest(`/api/admin/users/${user.id}/deactivate`, { method: 'POST' });
              fetchUsers();
          }}
        ]);
      } else {
        await apiRequest(`/api/admin/users/${user.id}/reactivate`, { method: 'POST' });
        fetchUsers();
      }
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const handleDeleteGroup = async (group: AdminGroup) => {
    Alert.alert('Delete Group', `Are you sure you want to permanently delete "${group.name}" and all its expenses?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Permanently', style: 'destructive', onPress: async () => {
          try {
            await apiRequest(`/api/admin/groups/${group.id}`, { method: 'DELETE' });
            fetchGroups();
          } catch (e: any) { Alert.alert('Error', e.message); }
      }}
    ]);
  };

  // --- RENDERERS ---

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[
          { key: 'overview', label: 'Overview', icon: 'pie-chart' },
          { key: 'users', label: 'Users', icon: 'people' },
          { key: 'groups', label: 'Groups', icon: 'layers' },
          { key: 'settings', label: 'Settings', icon: 'settings' }
        ] as const}
        keyExtractor={i => i.key}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setActiveTab(item.key)}
            style={[styles.tab, activeTab === item.key ? { backgroundColor: colors.primary } : { backgroundColor: colors.surface }]}
          >
            <Ionicons name={item.icon as any} size={16} color={activeTab === item.key ? '#FFF' : colors.textSecondary} />
            <Text style={[styles.tabText, { color: activeTab === item.key ? '#FFF' : colors.textSecondary }]}>{item.label}</Text>
          </Pressable>
        )}
      />
    </View>
  );

  const renderOverview = () => {
    if (!stats) return null;
    const statItems = [
      { title: 'TOTAL USERS', value: stats.totalUsers, icon: 'people', color: '#3498DB' },
      { title: 'ACTIVE USERS', value: stats.activeUsers, icon: 'person-add', color: '#2ECC71' },
      { title: 'PRO USERS', value: stats.proUsers, icon: 'diamond', color: '#9B59B6' },
      { title: 'DEACTIVATED', value: stats.deactivatedUsers, icon: 'person-remove', color: '#E74C3C' },
      { title: 'TOTAL GROUPS', value: stats.totalGroups, icon: 'layers', color: '#F39C12' },
      { title: 'TOTAL EXPENSES', value: stats.totalExpenses, icon: 'receipt', color: '#1ABC9C' },
      { title: 'TOTAL REFERRALS', value: stats.totalReferrals, icon: 'gift', color: '#E67E22' },
      { title: 'TOTAL REVENUE', value: `₹${Math.round(stats.totalRevenue)}`, icon: 'cash', color: '#F1C40F' },
    ];

    return (
      <View style={styles.tabContent}>
        <View style={styles.statsGrid}>
          {statItems.map((item, index) => (
            <Card key={index} variant="default" style={styles.statCard}>
              <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon as any} size={20} color={item.color} />
              </View>
              <Text style={[styles.statVal, { color: colors.text }]}>{item.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{item.title}</Text>
            </Card>
          ))}
        </View>
      </View>
    );
  };

  const renderUsers = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchRow}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={userSearch}
            onChangeText={setUserSearch}
            placeholder="Search users by name or email..."
            placeholderTextColor={colors.textTertiary}
          />
        </View>
        <Pressable onPress={() => setUserFilter(f => f === 'pro' ? '' : 'pro')} style={[styles.filterBtn, userFilter === 'pro' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <Text style={[styles.filterBtnText, { color: userFilter === 'pro' ? '#FFF' : colors.textSecondary }]}>Pro</Text>
        </Pressable>
      </View>

      {users.map(user => (
        <Card key={user.id} variant="default" style={styles.listCard}>
          <View style={styles.cardHeader}>
            <Avatar name={user.name} color={user.avatar_color} size={42} fontSize={16} />
            <View style={styles.cardMeta}>
              <Text style={[styles.userName, { color: colors.text }]}>{user.name} {user.is_admin ? '👑' : ''}</Text>
              <Text style={[styles.userEmail, { color: colors.textTertiary }]}>{user.email || 'N/A'}</Text>
            </View>
            <View style={[styles.badge, { borderColor: user.is_active ? '#2ECC7140' : '#E74C3C40' }]}>
              <Text style={[styles.badgeText, { color: user.is_active ? '#2ECC71' : '#E74C3C' }]}>
                {user.is_active ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.statsRow}>
            <Text style={[styles.statsText, { color: colors.textSecondary }]}>Groups: {user.group_count}</Text>
            <Text style={[styles.statsText, { color: colors.textSecondary }]}>Friends: {user.friend_count}</Text>
            <Text style={[styles.statsText, { color: colors.textSecondary }]}>Purchases: {user.purchase_count}</Text>
          </View>
          <View style={styles.actionsRow}>
            <Pressable onPress={() => handleTogglePro(user)} style={[styles.actionBtn, { backgroundColor: user.is_pro ? '#9B59B6' : colors.surface, borderColor: user.is_pro ? '#9B59B6' : colors.border }]}>
              <Text style={[styles.actionBtnText, { color: user.is_pro ? '#FFF' : colors.text }]}>PRO</Text>
            </Pressable>
            <Pressable onPress={() => handleToggleAdmin(user)} style={[styles.actionBtn, { backgroundColor: user.is_admin ? '#E67E22' : colors.surface, borderColor: user.is_admin ? '#E67E22' : colors.border }]}>
              <Text style={[styles.actionBtnText, { color: user.is_admin ? '#FFF' : colors.text }]}>ADMIN</Text>
            </Pressable>
            <Pressable onPress={() => handleToggleActive(user)} style={[styles.actionBtn, { backgroundColor: user.is_active ? colors.surface : '#2ECC71', borderColor: user.is_active ? '#E74C3C' : '#2ECC71' }]}>
              <Text style={[styles.actionBtnText, { color: user.is_active ? '#E74C3C' : '#FFF' }]}>{user.is_active ? 'DEACTIVATE' : 'REACTIVATE'}</Text>
            </Pressable>
          </View>
        </Card>
      ))}
    </View>
  );

  const renderGroups = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchRow}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={groupSearch}
            onChangeText={setGroupSearch}
            placeholder="Search groups..."
            placeholderTextColor={colors.textTertiary}
          />
        </View>
      </View>

      {groups.map(group => (
        <Card key={group.id} variant="default" style={styles.listCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardMeta}>
              <Text style={[styles.userName, { color: colors.text }]}>{group.name}</Text>
              <Text style={[styles.userEmail, { color: colors.textTertiary }]}>Category: {group.category}</Text>
            </View>
            <Pressable onPress={() => handleDeleteGroup(group)} style={[styles.actionBtn, { borderColor: '#E74C3C' }]}>
              <Ionicons name="trash" size={16} color="#E74C3C" />
            </Pressable>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.statsRow}>
            <Text style={[styles.statsText, { color: colors.textSecondary }]}>Members: {group.member_count}</Text>
            <Text style={[styles.statsText, { color: colors.textSecondary }]}>Expenses: {group.expense_count}</Text>
            <Text style={[styles.statsText, { color: colors.textSecondary }]}>Settlements: {group.settlement_count}</Text>
          </View>
        </Card>
      ))}
    </View>
  );

  const renderSettings = () => (
    <View style={styles.tabContent}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PRICING CONFIGURATION</Text>
      <Card variant="default" style={styles.configCard}>
        <View style={styles.inputsRow}>
          <View style={styles.inputCol}>
            <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>PRO AMOUNT</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.inputCol}>
            <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>CURRENCY CODE</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={currency}
              onChangeText={setCurrency}
              autoCapitalize="characters"
            />
          </View>
        </View>
        <Pressable onPress={handleSavePricing} disabled={updatingConfig} style={[styles.updateBtn, { backgroundColor: colors.primary, opacity: updatingConfig ? 0.7 : 1 }]}>
          <Text style={styles.updateBtnText}>{updatingConfig ? 'Updating...' : 'Save Configuration'}</Text>
        </Pressable>
      </Card>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading Admin Console...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <Animated.View entering={FadeInUp.springify()} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Admin Console</Text>
        <View style={{ width: 40 }} />
      </Animated.View>

      {renderTabs()}

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <Animated.View entering={FadeInDown.springify()}>
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'users' && renderUsers()}
          {activeTab === 'groups' && renderGroups()}
          {activeTab === 'settings' && renderSettings()}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, marginBottom: 8 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  tabsContainer: { paddingHorizontal: Spacing.base, marginBottom: Spacing.md },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8, gap: 6 },
  tabText: { fontSize: 13, fontWeight: '700' },
  scrollContent: { padding: Spacing.base, paddingBottom: 60 },
  tabContent: { gap: Spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', padding: 14, gap: 8 },
  iconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 8 },
  configCard: { padding: Spacing.lg, gap: 16 },
  inputsRow: { flexDirection: 'row', gap: 12 },
  inputCol: { flex: 1, gap: 6 },
  inputLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  input: { padding: Spacing.md, borderRadius: BorderRadius.md, fontSize: 15, borderWidth: 1 },
  updateBtn: { padding: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center' },
  updateBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: BorderRadius.md, borderWidth: 1, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  filterBtn: { paddingHorizontal: 16, height: 44, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: '#444', justifyContent: 'center', alignItems: 'center' },
  filterBtnText: { fontSize: 13, fontWeight: '700' },
  listCard: { padding: Spacing.md, gap: Spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardMeta: { flex: 1, gap: 2 },
  userName: { fontSize: 15, fontWeight: '700' },
  userEmail: { fontSize: 12 },
  badge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  divider: { height: 1, marginVertical: 4 },
  statsRow: { flexDirection: 'row', gap: 16 },
  statsText: { fontSize: 11, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
