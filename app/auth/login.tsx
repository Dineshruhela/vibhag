import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearAllLocalData, setupLocalUserFromAuth } from '../../lib/database';
import { api } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  // Mode & Form states
  const [isLogin, setIsLogin] = useState(true);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Google Simulation states
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [showCustomGoogle, setShowCustomGoogle] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  // Apple Simulation states
  const [showAppleModal, setShowAppleModal] = useState(false);
  const [appleVerifying, setAppleVerifying] = useState(false);
  const [appleSuccess, setAppleSuccess] = useState(false);
  const [shareEmail, setShareEmail] = useState(true);

  // Reusable social login handler
  async function handleSocialAuth(provider: 'google' | 'apple', socialEmail: string, socialName: string) {
    setLoading(true);
    try {
      const result = await api.socialLogin({
        email: socialEmail.trim(),
        name: socialName.trim(),
        provider,
        avatar_color: '#' + Math.floor(Math.random() * 16777215).toString(16),
      });

      if (!result || !result.token || !result.user) {
        throw new Error('Invalid response from server');
      }

      await api.setToken(result.token);
      await setupLocalUserFromAuth(result.user);
      await AsyncStorage.removeItem('last_sync_timestamp');
      DeviceEventEmitter.emit('auth_change');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Social Auth Error:', error);
      Alert.alert('Authentication Failed', error.message || 'Could not verify your social account.');
    } finally {
      setLoading(false);
    }
  }

  // Apple Face ID simulation trigger
  function startAppleVerification() {
    setAppleVerifying(true);
    setTimeout(() => {
      setAppleVerifying(false);
      setAppleSuccess(true);
      setTimeout(() => {
        setShowAppleModal(false);
        setAppleSuccess(false);
        const emailToSend = shareEmail ? 'd.ruhela@icloud.com' : 'dinesh.hidden@privaterelay.appleid.com';
        handleSocialAuth('apple', emailToSend, 'Dinesh Ruhela');
      }, 800);
    }, 1200);
  }

  // Traditional Email/Password Auth
  async function handleAuth() {
    if (!email || !password || (!isLogin && !name)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      let result;
      if (isLogin) {
        result = await api.login({ email, password });
      } else {
        result = await api.signup({ name, email, password });
      }

      if (!result || !result.token || !result.user) {
        throw new Error('Invalid response from server');
      }

      await api.setToken(result.token);
      await setupLocalUserFromAuth(result.user);
      await AsyncStorage.removeItem('last_sync_timestamp');
      DeviceEventEmitter.emit('auth_change');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Auth Error:', error);
      Alert.alert('Auth Failed', error.message || 'Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForceLogout() {
    await api.logout();
    await clearAllLocalData();
    await AsyncStorage.removeItem('last_sync_timestamp');
    DeviceEventEmitter.emit('auth_change');
    Alert.alert('Logged out', 'All local data cleared. Please sign in again.');
    router.replace('/auth/login');
  }

  // Custom styling computed on the fly
  const appleBg = colors.text;
  const appleText = colors.background;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            {/* Elegant Header with Logo */}
            <View style={styles.header}>
              <View style={[styles.logoContainer, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="wallet-outline" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Vibhag</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isLogin
                  ? 'Sign in to split bills and track expenses with friends.'
                  : 'Join Vibhag to start tracking and splitting expenses with ease.'}
              </Text>
            </View>

            {loading && !showGoogleModal && !showAppleModal ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Signing you in...</Text>
              </View>
            ) : (
              <View style={styles.formContainer}>
                {!showEmailForm ? (
                  /* Primary Social Flows */
                  <View style={styles.socialFlowContainer}>
                    <Pressable
                      style={[
                        styles.socialBtn,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          borderWidth: 1,
                        },
                      ]}
                      android_ripple={{ color: colors.borderLight }}
                      onPress={() => setShowGoogleModal(true)}
                    >
                      <Ionicons name="logo-google" size={20} color="#EA4335" style={styles.socialIcon} />
                      <Text style={[styles.socialBtnText, { color: colors.text }]}>Continue with Google</Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.socialBtn,
                        {
                          backgroundColor: appleBg,
                        },
                      ]}
                      android_ripple={{ color: '#ffffff33' }}
                      onPress={() => setShowAppleModal(true)}
                    >
                      <Ionicons name="logo-apple" size={20} color={appleText} style={styles.socialIcon} />
                      <Text style={[styles.socialBtnText, { color: appleText }]}>Continue with Apple</Text>
                    </Pressable>

                    <View style={styles.dividerContainer}>
                      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                      <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or</Text>
                      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                    </View>

                    <Pressable
                      style={[
                        styles.socialBtn,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setShowEmailForm(true);
                      }}
                    >
                      <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.socialIcon} />
                      <Text style={[styles.socialBtnText, { color: colors.text }]}>Continue with Email</Text>
                    </Pressable>
                  </View>
                ) : (
                  /* Expanded Traditional Email/Password Form */
                  <View style={styles.emailFormContainer}>
                    <Text style={[styles.formHeader, { color: colors.text }]}>
                      {isLogin ? 'Sign in with Email' : 'Create Email Account'}
                    </Text>

                    {!isLogin && (
                      <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: colors.text }]}
                          onChangeText={setName}
                          value={name}
                          placeholder="Full Name"
                          placeholderTextColor={colors.textTertiary}
                        />
                      </View>
                    )}

                    <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        onChangeText={setEmail}
                        value={email}
                        placeholder="Email Address"
                        placeholderTextColor={colors.textTertiary}
                        autoCapitalize={'none'}
                        keyboardType="email-address"
                      />
                    </View>

                    <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { color: colors.text }]}
                        onChangeText={setPassword}
                        value={password}
                        secureTextEntry={true}
                        placeholder="Password"
                        placeholderTextColor={colors.textTertiary}
                        autoCapitalize={'none'}
                      />
                    </View>

                    <Pressable
                      style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
                      disabled={loading}
                      onPress={handleAuth}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFF" />
                      ) : (
                        <Text style={styles.btnText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>
                      )}
                    </Pressable>

                    <View style={styles.emailFooter}>
                      <Pressable
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setIsLogin(!isLogin);
                        }}
                        disabled={loading}
                      >
                        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                          {isLogin ? "Don't have an account? " : "Already have an account? "}
                          <Text style={{ color: colors.primary, fontWeight: '700' }}>
                            {isLogin ? 'Sign Up' : 'Sign In'}
                          </Text>
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setShowEmailForm(false);
                        }}
                        disabled={loading}
                        style={{ marginTop: Spacing.sm }}
                      >
                        <Text style={{ color: colors.primary, fontWeight: '600', textAlign: 'center' }}>
                          Use Google or Apple instead
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* General Footer */}
            <View style={styles.footer}>
              {isLogin && showEmailForm && (
                <Pressable style={styles.forgotBtn}>
                  <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot Password?</Text>
                </Pressable>
              )}

              <Pressable onPress={handleForceLogout} style={{ marginTop: 24 }} hitSlop={12}>
                <Text style={{ color: colors.textTertiary, fontSize: 13, textDecorationLine: 'underline' }}>
                  Reset App & Clear Cache
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ================= GOOGLE AUTH SIMULATION MODAL ================= */}
      <Modal
        visible={showGoogleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowGoogleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowGoogleModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

            <View style={styles.googleBrandContainer}>
              <Ionicons name="logo-google" size={32} color="#EA4335" />
              <Text style={[styles.googleTitle, { color: colors.text }]}>Choose an account</Text>
              <Text style={[styles.googleSubtitle, { color: colors.textSecondary }]}>
                to continue to Vibhag
              </Text>
            </View>

            {showCustomGoogle ? (
              <View style={styles.customGoogleContainer}>
                <Text style={[styles.customGoogleHeader, { color: colors.text }]}>Enter Mock Account Details</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="Full Name"
                  placeholderTextColor={colors.textTertiary}
                  value={customName}
                  onChangeText={setCustomName}
                />
                <TextInput
                  style={[styles.modalInput, { color: colors.text, borderColor: colors.border, marginTop: Spacing.sm }]}
                  placeholder="Email Address"
                  placeholderTextColor={colors.textTertiary}
                  value={customEmail}
                  onChangeText={setCustomEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />

                <View style={styles.customGoogleButtons}>
                  <Pressable
                    style={[styles.customGoogleBtn, { backgroundColor: colors.border }]}
                    onPress={() => setShowCustomGoogle(false)}
                  >
                    <Text style={{ color: colors.text, fontWeight: '600' }}>Cancel</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.customGoogleBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      if (!customEmail || !customName) {
                        Alert.alert('Error', 'Please fill in both name and email');
                        return;
                      }
                      setShowGoogleModal(false);
                      setShowCustomGoogle(false);
                      handleSocialAuth('google', customEmail, customName);
                    }}
                  >
                    <Text style={{ color: '#FFF', fontWeight: '600' }}>Sign In</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <ScrollView style={styles.accountsList} showsVerticalScrollIndicator={false}>
                {/* Mock Account 1 */}
                <Pressable
                  style={[styles.googleAccountItem, { borderBottomColor: colors.borderLight }]}
                  onPress={() => {
                    setShowGoogleModal(false);
                    handleSocialAuth('google', 'dinesh.ruhela@gmail.com', 'Dinesh Ruhela');
                  }}
                >
                  <View style={[styles.googleAvatar, { backgroundColor: '#FF6B6B' }]}>
                    <Text style={styles.googleAvatarText}>DR</Text>
                  </View>
                  <View style={styles.googleAccountDetails}>
                    <Text style={[styles.googleAccountName, { color: colors.text }]}>Dinesh Ruhela</Text>
                    <Text style={[styles.googleAccountEmail, { color: colors.textSecondary }]}>dinesh.ruhela@gmail.com</Text>
                  </View>
                  <Ionicons name="chevron-forward-outline" size={18} color={colors.textTertiary} />
                </Pressable>

                {/* Mock Account 2 */}
                <Pressable
                  style={[styles.googleAccountItem, { borderBottomColor: colors.borderLight }]}
                  onPress={() => {
                    setShowGoogleModal(false);
                    handleSocialAuth('google', 'dinesh.work@vibhag.com', 'Dinesh Work');
                  }}
                >
                  <View style={[styles.googleAvatar, { backgroundColor: '#4ECDC4' }]}>
                    <Text style={styles.googleAvatarText}>DW</Text>
                  </View>
                  <View style={styles.googleAccountDetails}>
                    <Text style={[styles.googleAccountName, { color: colors.text }]}>Dinesh Work</Text>
                    <Text style={[styles.googleAccountEmail, { color: colors.textSecondary }]}>dinesh.work@vibhag.com</Text>
                  </View>
                  <Ionicons name="chevron-forward-outline" size={18} color={colors.textTertiary} />
                </Pressable>

                {/* Custom Mock Account Input */}
                <Pressable
                  style={[styles.googleAccountItem, { borderBottomColor: 'transparent' }]}
                  onPress={() => setShowCustomGoogle(true)}
                >
                  <View style={[styles.googleAvatar, { backgroundColor: colors.border }]}>
                    <Ionicons name="person-add-outline" size={20} color={colors.textSecondary} />
                  </View>
                  <View style={styles.googleAccountDetails}>
                    <Text style={[styles.googleAccountName, { color: colors.text }]}>Use another account</Text>
                    <Text style={[styles.googleAccountEmail, { color: colors.textSecondary }]}>Enter any email & name to test</Text>
                  </View>
                  <Ionicons name="chevron-forward-outline" size={18} color={colors.textTertiary} />
                </Pressable>
              </ScrollView>
            )}

            <Text style={[styles.googleDisclaimer, { color: colors.textTertiary }]}>
              To continue, Google will share your name, email address, language preference, and profile picture with Vibhag.
            </Text>
          </View>
        </View>
      </Modal>

      {/* ================= APPLE AUTH SIMULATION MODAL ================= */}
      <Modal
        visible={showAppleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAppleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={() => setShowAppleModal(false)} />
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.dragHandle, { backgroundColor: colors.border }]} />

            <View style={styles.appleHeader}>
              <Ionicons name="logo-apple" size={26} color={colors.text} />
              <Text style={[styles.appleTitle, { color: colors.text }]}>Sign in with Apple ID</Text>
            </View>

            {!appleVerifying && !appleSuccess ? (
              <View style={styles.applePanel}>
                <View style={[styles.appleAccountCard, { backgroundColor: colors.surfaceSecondary }]}>
                  <View style={styles.appleAppInfo}>
                    <Text style={[styles.appleLabel, { color: colors.textSecondary }]}>App</Text>
                    <Text style={[styles.appleValue, { color: colors.text }]}>Vibhag</Text>
                  </View>
                  <View style={[styles.appleSeparator, { backgroundColor: colors.border }]} />
                  <View style={styles.appleAppInfo}>
                    <Text style={[styles.appleLabel, { color: colors.textSecondary }]}>Apple ID</Text>
                    <Text style={[styles.appleValue, { color: colors.text }]}>Dinesh Ruhela (d.ruhela@icloud.com)</Text>
                  </View>
                </View>

                {/* Email Share Choices */}
                <View style={styles.appleChoiceContainer}>
                  <Pressable
                    style={styles.appleChoiceRow}
                    onPress={() => setShareEmail(true)}
                  >
                    <Ionicons
                      name={shareEmail ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={shareEmail ? colors.primary : colors.textTertiary}
                    />
                    <View style={styles.appleChoiceText}>
                      <Text style={[styles.appleChoiceTitle, { color: colors.text }]}>Share My Email</Text>
                      <Text style={[styles.appleChoiceDesc, { color: colors.textSecondary }]}>d.ruhela@icloud.com</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={styles.appleChoiceRow}
                    onPress={() => setShareEmail(false)}
                  >
                    <Ionicons
                      name={!shareEmail ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={!shareEmail ? colors.primary : colors.textTertiary}
                    />
                    <View style={styles.appleChoiceText}>
                      <Text style={[styles.appleChoiceTitle, { color: colors.text }]}>Hide My Email</Text>
                      <Text style={[styles.appleChoiceDesc, { color: colors.textSecondary }]}>Forwards to your email inbox</Text>
                    </View>
                  </Pressable>
                </View>

                {/* FaceID Action Button */}
                <Pressable
                  style={[styles.btn, { backgroundColor: appleBg, marginTop: Spacing.xl }]}
                  onPress={startAppleVerification}
                >
                  <Text style={[styles.btnText, { color: appleText }]}>Confirm with Face ID</Text>
                </Pressable>

                <Pressable
                  style={styles.appleCancelBtn}
                  onPress={() => setShowAppleModal(false)}
                >
                  <Text style={[styles.appleCancelText, { color: colors.primary }]}>Cancel</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.appleVerificationContainer}>
                {appleVerifying && (
                  <View style={styles.alignCenter}>
                    <View style={[styles.faceIdRing, { borderColor: colors.primary }]}>
                      <Ionicons name="scan-outline" size={44} color={colors.primary} />
                      <ActivityIndicator
                        size={84}
                        color={colors.primary}
                        style={StyleSheet.absoluteFillObject}
                      />
                    </View>
                    <Text style={[styles.appleVerificationText, { color: colors.text }]}>
                      Verifying with Face ID...
                    </Text>
                  </View>
                )}

                {appleSuccess && (
                  <View style={styles.alignCenter}>
                    <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                    <Text style={[styles.appleVerificationText, { color: colors.success }]}>
                      Apple ID Verified
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContainer: { flexGrow: 1 },
  container: {
    flex: 1,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl * 1.5,
    marginTop: Spacing.xl,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: Spacing.base,
  },
  formContainer: {
    minHeight: 280,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
    fontWeight: '600',
  },
  socialFlowContainer: {
    gap: Spacing.sm,
  },
  socialBtn: {
    height: 54,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  socialIcon: {
    marginRight: 12,
  },
  socialBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.base,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: Spacing.base,
    fontSize: 14,
    fontWeight: '600',
  },
  emailFormContainer: {
    gap: Spacing.md,
  },
  formHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  btn: {
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  btnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emailFooter: {
    marginTop: Spacing.base,
    gap: Spacing.sm,
  },
  footer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  forgotBtn: {
    paddingVertical: Spacing.sm,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Modal styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    paddingBottom: Spacing.xl * 1.5,
    minHeight: 400,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'center',
    marginBottom: Spacing.xl,
  },
  googleBrandContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  googleTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  googleSubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  accountsList: {
    maxHeight: 250,
  },
  googleAccountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    borderBottomWidth: 1,
  },
  googleAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  googleAvatarText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  googleAccountDetails: {
    flex: 1,
  },
  googleAccountName: {
    fontSize: 15,
    fontWeight: '600',
  },
  googleAccountEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  googleDisclaimer: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },

  // Apple Modal specific
  appleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  appleTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginLeft: Spacing.sm,
  },
  applePanel: {
    flex: 1,
  },
  appleAccountCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.lg,
  },
  appleAppInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appleLabel: {
    fontSize: 14,
  },
  appleValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  appleSeparator: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  appleChoiceContainer: {
    gap: Spacing.md,
  },
  appleChoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  appleChoiceText: {
    flex: 1,
  },
  appleChoiceTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  appleChoiceDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  appleCancelBtn: {
    alignItems: 'center',
    marginTop: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  appleCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  appleVerificationContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alignCenter: {
    alignItems: 'center',
  },
  faceIdRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  appleVerificationText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Custom Google input UI
  customGoogleContainer: {
    paddingVertical: Spacing.sm,
  },
  customGoogleHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.base,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: 15,
  },
  customGoogleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
    gap: Spacing.base,
  },
  customGoogleBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
