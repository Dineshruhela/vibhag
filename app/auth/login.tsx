import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  LayoutAnimation,
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

// Safe require for Google Sign-In to prevent crashing in Expo Go
let GoogleSignin: any = null;
let statusCodes: any = {};
try {
  const GoogleModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = GoogleModule.GoogleSignin;
  statusCodes = GoogleModule.statusCodes;
  if (GoogleSignin) {
    const config: any = {
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      offlineAccess: false,
    };
    if (Platform.OS === 'ios') {
      config.iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    } else if (Platform.OS === 'android') {
      if (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID) {
        config.androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
      }
    }
    GoogleSignin.configure(config);
  }
} catch (e) {
  console.warn('Google Sign-In native module not found (ignored on Expo Go).');
}

// Safe require for Apple Authentication to prevent crashing in Expo Go
let AppleAuthentication: any = null;
try {
  AppleAuthentication = require('expo-apple-authentication');
} catch (e) {
  console.warn('Apple Authentication native module not found (ignored on Expo Go).');
}

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
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Apple availability (iOS only)
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios' && AppleAuthentication) {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAuthAvailable)
        .catch(() => setAppleAuthAvailable(false));
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('pending_referral_code')
      .then(code => {
        if (code) {
          console.log('[LoginScreen] Loaded pending referral code:', code);
          setReferralCode(code);
        }
      })
      .catch(err => console.warn('[LoginScreen] Failed to load pending referral code:', err));
  }, []);

  // Handle social auth result from backend
  async function handleSocialResult(result: any) {
    if (!result || !result.token || !result.user) {
      throw new Error('Invalid response from server');
    }

    await api.setToken(result.token);
    await setupLocalUserFromAuth(result.user);
    await AsyncStorage.removeItem('last_sync_timestamp');
    await AsyncStorage.removeItem('pending_referral_code');
    DeviceEventEmitter.emit('auth_change');
    router.replace('/(tabs)');
  }

  // Google Sign-In
  async function handleGoogleSignIn() {
    if (!GoogleSignin) {
      Alert.alert(
        'Development Build Required',
        'Google Sign-in requires native components. Please run the app in a custom Development Build (npx expo run:ios/android or eas build) instead of standard Expo Go.'
      );
      return;
    }

    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();

      const idToken = response?.data?.idToken;
      if (!idToken) {
        throw new Error('Failed to get Google ID token');
      }

      const result = await api.socialLogin({
        idToken,
        provider: 'google',
        avatar_color: '#' + Math.floor(Math.random() * 16777215).toString(16),
        referralCode: referralCode.trim() || undefined,
      });

      await handleSocialResult(result);
    } catch (error: any) {
      if (error.code === statusCodes?.SIGN_IN_CANCELLED) {
        // User cancelled, do nothing
      } else if (error.code === statusCodes?.IN_PROGRESS) {
        // Sign-in already in progress
      } else if (error.code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services are not available on this device.');
      } else {
        console.error('Google Sign-In Error:', error);
        Alert.alert('Google Sign-In Failed', error.message || 'Could not sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Apple Sign-In (iOS only)
  async function handleAppleSignIn() {
    if (!AppleAuthentication) {
      Alert.alert(
        'Development Build Required',
        'Apple Sign-in requires native components. Please run the app in a custom Development Build (npx expo run:ios/android or eas build) instead of standard Expo Go.'
      );
      return;
    }

    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Failed to get Apple identity token');
      }

      // Apple only returns the name on the FIRST sign-in, so we capture it
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(' ')
        : null;

      const result = await api.socialLogin({
        idToken: credential.identityToken,
        provider: 'apple',
        fullName: fullName || undefined,
        avatar_color: '#' + Math.floor(Math.random() * 16777215).toString(16),
        referralCode: referralCode.trim() || undefined,
      });

      await handleSocialResult(result);
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled, do nothing
      } else {
        console.error('Apple Sign-In Error:', error);
        Alert.alert('Apple Sign-In Failed', error.message || 'Could not sign in with Apple.');
      }
    } finally {
      setLoading(false);
    }
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
        result = await api.signup({ name, email, password, referralCode: referralCode.trim() || undefined });
      }

      await handleSocialResult(result);
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
              <Text style={[styles.title, { color: colors.text }]}>Splitmaro</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isLogin
                  ? 'Sign in to split bills and track expenses with friends.'
                  : 'Join Splitmaro to start tracking and splitting expenses with ease.'}
              </Text>
            </View>

            {loading ? (
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
                      onPress={handleGoogleSignIn}
                    >
                      <Ionicons name="logo-google" size={20} color="#EA4335" style={styles.socialIcon} />
                      <Text style={[styles.socialBtnText, { color: colors.text }]}>Continue with Google</Text>
                    </Pressable>

                    {Platform.OS === 'ios' && appleAuthAvailable && (
                      <Pressable
                        style={[
                          styles.socialBtn,
                          {
                            backgroundColor: appleBg,
                          },
                        ]}
                        onPress={handleAppleSignIn}
                      >
                        <Ionicons name="logo-apple" size={20} color={appleText} style={styles.socialIcon} />
                        <Text style={[styles.socialBtnText, { color: appleText }]}>Continue with Apple</Text>
                      </Pressable>
                    )}

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

                    {!isLogin && (
                      <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        <Ionicons name="gift-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.input, { color: colors.text }]}
                          onChangeText={setReferralCode}
                          value={referralCode}
                          placeholder="Referral Code (Optional)"
                          placeholderTextColor={colors.textTertiary}
                          autoCapitalize={'none'}
                        />
                      </View>
                    )}

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
              {/* Forgot Password: hidden until proper email-based reset flow is built */}

              <Pressable onPress={handleForceLogout} style={{ marginTop: 24 }} hitSlop={12}>
                <Text style={{ color: colors.textTertiary, fontSize: 13, textDecorationLine: 'underline' }}>
                  Reset App & Clear Cache
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
});
