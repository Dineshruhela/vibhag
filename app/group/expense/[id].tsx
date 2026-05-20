import { Avatar } from '@/components/Avatar';
import { Card } from '@/components/Card';
import { CategoryColors } from '@/constants/Colors';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/format';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addExpenseComment, deleteExpense, getExpense, getExpenseComments, getExpensePayers, getExpenseShares, type Expense, type ExpenseComment, type ExpensePayer, type ExpenseShare } from '../../../lib/database';

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const router = useRouter();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [payers, setPayers] = useState<ExpensePayer[]>([]);
  const [shares, setShares] = useState<ExpenseShare[]>([]);
  const [comments, setComments] = useState<ExpenseComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewImageVisible, setViewImageVisible] = useState(false);

  const loadExpense = useCallback(async () => {
    if (!id) return;
    try {
      const [e, p, s, c] = await Promise.all([
        getExpense(id),
        getExpensePayers(id),
        getExpenseShares(id),
        getExpenseComments(id)
      ]);
      setExpense(e);
      setPayers(p);
      setShares(s);
      setComments(c);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load expense details');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { loadExpense(); }, [loadExpense]));

  const handleAddComment = async () => {
    if (!newComment.trim() || !id) return;
    setSubmitting(true);
    try {
      const added = await addExpenseComment(id, newComment.trim());
      setComments(prev => [...prev, added]);
      setNewComment('');
    } catch (e) {
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Expense', 'Are you sure you want to delete this expense? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          try {
            await deleteExpense(id);
            router.back();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete expense');
          }
        }
      }
    ]);
  };

  if (loading || !expense) {
    return <View style={[styles.root, { backgroundColor: colors.background }]} />;
  }

  const cat = CategoryColors[expense.category] || CategoryColors.general;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable onPress={() => router.push({ pathname: '/group/expense/edit' as any, params: { id: expense.id } })} hitSlop={12} style={styles.deleteBtn}>
            <Ionicons name="pencil" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={handleDelete} hitSlop={12} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={22} color={colors.negative} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Main Info */}
        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.hero}>
          <View style={[styles.iconBox, { backgroundColor: cat.color + '20' }]}>
            <Ionicons name={cat.icon as any} size={48} color={cat.color} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{expense.description}</Text>
          <Text style={[styles.amount, { color: colors.text }]}>{formatCurrency(expense.amount)}</Text>
          <Text style={[styles.meta, { color: colors.textTertiary }]}>
            Added by {expense.creator_name || 'You'} on {formatDate(expense.created_at)}
          </Text>
          {expense.group_name && (
            <View style={[styles.groupBadge, { backgroundColor: colors.surface }]}>
              <Ionicons name="people" size={14} color={colors.textSecondary} />
              <Text style={[styles.groupBadgeText, { color: colors.textSecondary }]}>{expense.group_name}</Text>
            </View>
          )}
        </Animated.View>

        {/* Breakdown */}
        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Paid By</Text>
          <Card variant="default" padding={0} style={styles.card}>
            {payers.map((payer, i) => (
              <View key={payer.user_id} style={[styles.row, i < payers.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <Avatar name={payer.name || 'You'} color={colors.primary} size={36} />
                <Text style={[styles.name, { color: colors.text }]}>{payer.name || 'You'}</Text>
                <Text style={[styles.rowAmount, { color: colors.text }]}>{formatCurrency(payer.amount)}</Text>
              </View>
            ))}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Split For</Text>
          <Card variant="default" padding={0} style={styles.card}>
            {shares.map((share, i) => (
              <View key={share.user_id} style={[styles.row, i < shares.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <Avatar name={share.name || 'You'} color={colors.positive} size={36} />
                <Text style={[styles.name, { color: colors.text }]}>{share.name || 'You'}</Text>
                <Text style={[styles.rowAmount, { color: colors.text }]}>{formatCurrency(share.share_amount)}</Text>
              </View>
            ))}
          </Card>
        </Animated.View>

        {!!expense.receipt_uri && (
          <Animated.View entering={FadeInDown.delay(350).springify()}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Receipt Photo</Text>
            <Card variant="default" padding={Spacing.md} style={styles.card}>
              <Pressable onPress={() => setViewImageVisible(true)} style={styles.receiptContainer}>
                <Image
                  source={{ uri: expense.receipt_uri }}
                  style={[styles.receiptImage, { borderColor: colors.border }]}
                  resizeMode="cover"
                />
                <View style={[styles.expandOverlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
                  <Ionicons name="expand" size={18} color="#FFF" />
                  <Text style={styles.expandText}>Tap to zoom</Text>
                </View>
              </Pressable>
            </Card>

            <Modal
              visible={viewImageVisible}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setViewImageVisible(false)}
            >
              <View style={styles.modalBackground}>
                <Pressable style={styles.modalCloseBtn} onPress={() => setViewImageVisible(false)} hitSlop={12}>
                  <Ionicons name="close" size={28} color="#FFF" />
                </Pressable>
                <Pressable style={styles.modalOverlay} onPress={() => setViewImageVisible(false)}>
                  <Image
                    source={{ uri: expense.receipt_uri }}
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                </Pressable>
              </View>
            </Modal>
          </Animated.View>
        )}

        {/* Comments */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Comments ({comments.length})</Text>
          <Card variant="default" padding={Spacing.md} style={styles.card}>
            {comments.map((comment, i) => (
              <View key={comment.id} style={[styles.commentRow, i < comments.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight }]}>
                <Avatar name={comment.user_name || 'You'} color={comment.user_avatar_color || colors.primary} size={32} fontSize={12} />
                <View style={styles.commentContent}>
                  <View style={styles.commentHeader}>
                    <Text style={[styles.commentName, { color: colors.text }]}>{comment.user_name || 'You'}</Text>
                    <Text style={[styles.commentTime, { color: colors.textTertiary }]}>{formatRelativeTime(comment.created_at)}</Text>
                  </View>
                  <Text style={[styles.commentText, { color: colors.textSecondary }]}>{comment.text}</Text>
                </View>
              </View>
            ))}
            {comments.length === 0 && (
              <Text style={{ textAlign: 'center', color: colors.textTertiary, marginVertical: Spacing.md }}>No comments yet. Be the first!</Text>
            )}
            
            <View style={[styles.commentInputRow, { borderTopWidth: comments.length > 0 ? 1 : 0, borderTopColor: colors.borderLight, paddingTop: comments.length > 0 ? Spacing.md : 0 }]}>
              <TextInput
                style={[styles.commentInput, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textTertiary}
                value={newComment}
                onChangeText={setNewComment}
                multiline
              />
              <Pressable
                onPress={handleAddComment}
                disabled={submitting || !newComment.trim()}
                style={[styles.sendBtn, { backgroundColor: newComment.trim() ? colors.primary : colors.surfaceSecondary }]}
              >
                <Ionicons name="send" size={16} color={newComment.trim() ? '#FFF' : colors.textTertiary} />
              </Pressable>
            </View>
          </Card>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  backBtn: { padding: 4 },
  deleteBtn: { padding: 4 },
  scroll: { padding: Spacing.base },
  hero: { alignItems: 'center', marginVertical: Spacing.lg },
  iconBox: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  amount: { fontSize: 36, fontWeight: '800', marginBottom: 8 },
  meta: { fontSize: 13 },
  groupBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6, marginTop: 12 },
  groupBadgeText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, marginTop: Spacing.lg, paddingHorizontal: 4 },
  card: { marginBottom: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
  name: { flex: 1, fontSize: 15, fontWeight: '600' },
  rowAmount: { fontSize: 15, fontWeight: '700' },
  commentRow: { flexDirection: 'row', paddingVertical: Spacing.md, gap: 12 },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  commentName: { fontSize: 14, fontWeight: '600' },
  commentTime: { fontSize: 12 },
  commentText: { fontSize: 15, lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: Spacing.sm },
  commentInput: { flex: 1, minHeight: 40, maxHeight: 100, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  receiptContainer: { position: 'relative', borderRadius: BorderRadius.md, overflow: 'hidden' },
  receiptImage: { width: '100%', height: 200, borderRadius: BorderRadius.md, borderWidth: 1 },
  expandOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  expandText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  modalBackground: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.95)' },
  modalCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.15)', alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalImage: { width: '90%', height: '80%' },
});
