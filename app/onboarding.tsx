import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Dimensions, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUser, updateUser } from '../lib/database';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type OnboardingStep = 'welcome' | 'features' | 'name';

const FEATURES = [
  {
    icon: 'wallet-outline' as const,
    title: 'Smart Expense Splitting',
    description: 'Split bills, track debts, and settle up with friends — all from one beautiful app.',
    color: '#1CC29F',
  },
  {
    icon: 'cloud-done-outline' as const,
    title: 'Offline-First & Cloud Sync',
    description: 'Works without internet. Your data syncs automatically across devices when you\'re back online.',
    color: '#5C6BC0',
  },
  {
    icon: 'bar-chart-outline' as const,
    title: 'Spending Insights & Budgets',
    description: 'Track spending by category, set monthly budgets, and get smart alerts when you\'re close to your limit.',
    color: '#FF6B6B',
  },
];

export default function OnboardingScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [featureIndex, setFeatureIndex] = useState(0);
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

  const handleFeatureNext = () => {
    if (featureIndex < FEATURES.length - 1) {
      setFeatureIndex(featureIndex + 1);
    } else {
      setStep('name');
    }
  };

  const renderWelcome = () => (
    <Animated.View entering={FadeIn.duration(600)} style={styles.slideContent}>
      <View style={styles.welcomeContainer}>
        {/* App Icon / Logo */}
        <Animated.View entering={FadeInDown.delay(200).springify()} style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
          <Ionicons name="wallet" size={56} color="#FFF" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Text style={[styles.welcomeTitle, { color: colors.text }]}>Welcome to{'\n'}Splitmaro</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).springify()}>
          <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
            The smartest way to split expenses, track balances, and settle debts with friends and groups.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(800).springify()} style={styles.featurePills}>
          {['Offline-First', 'Cloud Sync', 'Smart Analytics'].map((label, i) => (
            <View key={i} style={[styles.pill, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
              <Text style={[styles.pillText, { color: colors.primary }]}>{label}</Text>
            </View>
          ))}
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(1000).springify()} style={styles.bottomAction}>
        <Pressable
          onPress={() => setStep('features')}
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.primaryBtnText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFF" />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );

  const renderFeatures = () => {
    const feature = FEATURES[featureIndex];
    return (
      <Animated.View key={`feature-${featureIndex}`} entering={SlideInRight.duration(350)} style={styles.slideContent}>
        <View style={styles.featureContainer}>
          {/* Progress Dots */}
          <View style={styles.dotsRow}>
            {FEATURES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === featureIndex ? colors.primary : colors.border,
                    width: i === featureIndex ? 24 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Feature Icon */}
          <Animated.View
            entering={FadeInDown.delay(100).springify()}
            style={[styles.featureIconBox, { backgroundColor: feature.color + '15' }]}
          >
            <Ionicons name={feature.icon} size={56} color={feature.color} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>{feature.title}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>
              {feature.description}
            </Text>
          </Animated.View>
        </View>

        <View style={styles.bottomAction}>
          <View style={styles.featureActions}>
            {featureIndex > 0 && (
              <Pressable
                onPress={() => setFeatureIndex(featureIndex - 1)}
                style={[styles.secondaryBtn, { borderColor: colors.border }]}
              >
                <Ionicons name="arrow-back" size={20} color={colors.textSecondary} />
              </Pressable>
            )}
            <Pressable
              onPress={handleFeatureNext}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}
            >
              <Text style={styles.primaryBtnText}>
                {featureIndex === FEATURES.length - 1 ? 'Set Up Profile' : 'Next'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFF" />
            </Pressable>
          </View>
          <Pressable onPress={() => setStep('name')}>
            <Text style={[styles.skipText, { color: colors.textTertiary }]}>Skip</Text>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const renderNameInput = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.slideContent}>
      <View style={styles.nameContainer}>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={[styles.iconBox, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="person" size={48} color={colors.primary} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify()}>
          <Text style={[styles.nameTitle, { color: colors.text }]}>What's your name?</Text>
          <Text style={[styles.nameSubtitle, { color: colors.textSecondary }]}>
            This helps your friends identify you when splitting expenses.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify()} style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Your Name"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.bottomAction}>
        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
        >
          <Text style={styles.primaryBtnText}>{saving ? 'Setting up...' : 'Start Splitting!'}</Text>
          <Ionicons name="checkmark" size={20} color="#FFF" />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      {step === 'welcome' && renderWelcome()}
      {step === 'features' && renderFeatures()}
      {step === 'name' && renderNameInput()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  slideContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.xl,
  },

  // Welcome
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 112,
    height: 112,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#1CC29F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  welcomeTitle: {
    fontSize: 36,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -1,
    lineHeight: 42,
    marginBottom: 16,
  },
  welcomeSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  featurePills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Features
  featureContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 48,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  featureIconBox: {
    width: 120,
    height: 120,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  featureTitle: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  featureDesc: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  featureActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },

  // Name Input
  nameContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  iconBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  nameTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  nameSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  inputContainer: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
  },
  input: { fontSize: 18 },

  // Bottom
  bottomAction: {
    gap: 12,
    paddingBottom: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: 8,
  },
  primaryBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryBtn: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
});
