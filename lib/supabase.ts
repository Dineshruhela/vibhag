import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const CHUNK_SIZE = 2000;

// Custom storage adapter using expo-secure-store for mobile (with chunking) and localStorage for web
const customStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined') return null;
      return window.localStorage.getItem(key);
    }
    
    // Check for chunked format first
    const chunkCountStr = await SecureStore.getItemAsync(`${key}_count`);
    if (!chunkCountStr) return await SecureStore.getItemAsync(key); // Legacy un-chunked

    const chunkCount = parseInt(chunkCountStr, 10);
    let fullValue = '';
    for (let i = 0; i < chunkCount; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk) fullValue += chunk;
    }
    return fullValue;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return;
    }

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.deleteItemAsync(`${key}_count`).catch(() => {});
      return await SecureStore.setItemAsync(key, value);
    }
    
    const chunkCount = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}_count`, chunkCount.toString());
    
    for (let i = 0; i < chunkCount; i++) {
      const chunk = value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      return;
    }

    const chunkCountStr = await SecureStore.getItemAsync(`${key}_count`);
    if (chunkCountStr) {
      const chunkCount = parseInt(chunkCountStr, 10);
      for (let i = 0; i < chunkCount; i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(`${key}_count`).catch(() => {});
    } else {
      await SecureStore.deleteItemAsync(key).catch(() => {});
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
