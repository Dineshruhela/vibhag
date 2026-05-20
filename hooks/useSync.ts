import { syncAll } from '@/lib/sync';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './useAuth';

export function useSync() {
  const { session } = useAuth();

  const handleSync = useCallback(() => {
    if (session) {
      syncAll();
    }
  }, [session]);

  const handleSyncRef = useRef(handleSync);
  useEffect(() => {
    handleSyncRef.current = handleSync;
  }, [handleSync]);

  // Initial sync
  useEffect(() => {
    handleSync();
  }, [handleSync]);

  // Sync on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        handleSyncRef.current();
      }
    });
    return () => sub.remove();
  }, []);

  return { session };
}
