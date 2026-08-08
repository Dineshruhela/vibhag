import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform, DeviceEventEmitter } from 'react-native';

let rawApiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
// Strip leading/trailing double quotes if they exist in the env variable
if (rawApiUrl.startsWith('"') && rawApiUrl.endsWith('"')) {
  rawApiUrl = rawApiUrl.slice(1, -1);
}

// Dynamically resolve localhost for native platforms to route to host computer's IP
if (Platform.OS !== 'web' && (rawApiUrl.includes('localhost') || rawApiUrl.includes('127.0.0.1'))) {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const metroIp = hostUri.split(':')[0];
    if (metroIp && metroIp !== 'localhost' && metroIp !== '127.0.0.1') {
      rawApiUrl = rawApiUrl.replace('localhost', metroIp).replace('127.0.0.1', metroIp);
      console.log(`[API] Dynamically resolved localhost to Metro host IP: ${rawApiUrl}`);
    }
  }
}

const API_URL = rawApiUrl;
const TOKEN_KEY = '0b5b295c-1461-47fd-808f-822e827f39ca';

/**
 * Enhanced fetch wrapper with robust error handling and network failure reporting.
 */
let activeRequestsCount = 0;

export function getActiveRequestsCount() {
  return activeRequestsCount;
}

export async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${API_URL}${path}`;
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as any),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Increment active requests count and emit loading event
  activeRequestsCount++;
  DeviceEventEmitter.emit('api_loading_change', true);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const text = await response.text();
      let errMsg = response.statusText || `Server Error (${response.status})`;

      // If response is HTML (e.g. Cloudflare 502 Bad Gateway), clean it up into a human-readable message
      if (text.startsWith('<!DOCTYPE') || text.includes('<html')) {
        if (response.status === 502) {
          errMsg = 'Server is currently undergoing maintenance (502 Bad Gateway). Please try again in a few moments.';
        } else if (response.status === 503) {
          errMsg = 'Server is temporarily unavailable (503 Service Unavailable). Please try again shortly.';
        } else if (response.status === 504) {
          errMsg = 'Server connection timed out (504 Gateway Timeout). Please try again.';
        } else {
          errMsg = `Server returned an error (${response.status}). Please try again later.`;
        }
      } else {
        try {
          const parsed = JSON.parse(text);
          if (parsed.error) {
            errMsg = parsed.error;
          }
        } catch (e) {
          if (text.trim().length > 0 && text.length < 200) {
            errMsg = text.trim();
          }
        }
      }
      throw new Error(errMsg);
    }

    // Safely handle empty responses or non-JSON content
    const contentType = response.headers.get('content-type');
    if (response.status === 204 || !contentType || !contentType.includes('application/json')) {
      return null;
    }

    return await response.json();
  } catch (error: any) {
    // Catch fetch/network errors specifically
    if (error.message === 'Network request failed') {
      throw new Error(`Connection Error: Unable to reach the server at ${API_URL}. Please check your internet connection or server status.`);
    }
    throw error;
  } finally {
    // Decrement active requests count and emit finish event when everything is done
    activeRequestsCount = Math.max(0, activeRequestsCount - 1);
    if (activeRequestsCount === 0) {
      DeviceEventEmitter.emit('api_loading_change', false);
    }
  }
}

export const api = {
  signup: (data: any) => apiRequest('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: any) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  socialLogin: (data: {
    idToken: string;
    provider: 'google' | 'apple';
    fullName?: string | null;
    avatar_color?: string;
    push_token?: string;
    referralCode?: string;
  }) => apiRequest('/auth/social', { method: 'POST', body: JSON.stringify(data) }),
  push: (data: any) => apiRequest('/api/sync/push', { method: 'POST', body: JSON.stringify(data) }),
  registerPushToken: (pushToken: string | null) => apiRequest('/api/users/me/push-token', {
    method: 'PUT',
    body: JSON.stringify({ pushToken }),
  }),
  pull: (lastSync: number) => apiRequest(`/api/sync/pull?lastSync=${lastSync}`),
  searchOrCreateUser: (data: { email: string; name: string; avatar_color?: string }) => apiRequest('/api/users/search-or-create', { method: 'POST', body: JSON.stringify(data) }),
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  logout: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
