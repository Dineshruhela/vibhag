import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { DeviceEventEmitter } from 'react-native';

export interface CustomSession {
  user: {
    id: string;
    email: string;
    name?: string;
  };
  token: string;
}

export function useAuth() {
  const [session, setSession] = useState<CustomSession | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const token = await api.getToken();
      if (token) {
        // For now, we decode the JWT or just trust it. 
        // In a real app, you'd fetch /auth/me
        // Simple base64 decode of JWT payload:
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64));
        setSession({
          token,
          user: {
            id: payload.userId,
            email: payload.email,
            name: payload.name
          }
        });
      } else {
        setSession(null);
      }
    } catch (e) {
      console.error('Auth check failed', e);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const sub = DeviceEventEmitter.addListener('auth_change', checkAuth);
    return () => sub.remove();
  }, []);

  return { session, loading };
}
