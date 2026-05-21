import { BorderRadius, Spacing } from '@/constants/Spacing';
import { useThemeColors } from '@/hooks/useThemeColor';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearAllLocalData, setupLocalUserFromAuth } from '../../lib/database';
import { api } from '../../lib/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

      // Store JWT token
      await api.setToken(result.token);

      // Setup the local SQLite user from server user details
      await setupLocalUserFromAuth(result.user);

      // Remove old sync timestamp and notify app of auth change
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

  // Helper: Force logout and clear all local data
  async function handleForceLogout() {
    await api.logout();
    await clearAllLocalData();
    await AsyncStorage.removeItem('last_sync_timestamp');
    DeviceEventEmitter.emit('auth_change');
    Alert.alert('Logged out', 'All local data cleared. Please sign in again.');
    router.replace('/auth/login');
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}> 
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>
                {isLogin ? 'Welcome back' : 'Create account'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {isLogin 
                  ? 'Sign in to sync your expenses across all your devices.' 
                  : 'Join Splitmaro to start tracking and splitting expenses with ease.'}
              </Text>
            </View>


            <View style={styles.form}>
              {!isLogin && (
                <View style={[styles.inputContainer, { backgroundColor: colors.surface }]}>
                  <TextInput
                    style={[styles.input, { color: colors.text }]}
                    onChangeText={setName}
                    value={name}
                    placeholder="Full Name"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              )}

              <View style={[styles.inputContainer, { backgroundColor: colors.surface, marginTop: Spacing.base }]}>
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

              <View style={[styles.inputContainer, { backgroundColor: colors.surface, marginTop: Spacing.base }]}>
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
            </View>

            <View style={styles.footer}>
              <Pressable onPress={() => setIsLogin(!isLogin)} disabled={loading}>
                <Text style={{ color: colors.textSecondary }}>
                  {isLogin ? "Don't have an account? " : "Already have an account? "}
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>
                    {isLogin ? 'Sign Up' : 'Sign In'}
                  </Text>
                </Text>
              </Pressable>

              {isLogin && (
                <Pressable style={styles.forgotBtn}>
                  <Text style={[styles.forgotText, { color: colors.primary }]}>Forgot Password?</Text>
                </Pressable>
              )}

              <Pressable onPress={handleForceLogout} style={{ marginTop: 12 }} hitSlop={12}>
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
    marginBottom: Spacing.xl * 1.5,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    gap: Spacing.md,
  },
  inputContainer: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  input: {
    fontSize: 16,
    padding: 12,
  },
  btn: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    height: 60,
    justifyContent: 'center',
  },
  btnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    marginTop: Spacing.xl * 2,
    alignItems: 'center',
    gap: Spacing.lg,
  },
  forgotBtn: {
    paddingVertical: Spacing.sm,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
