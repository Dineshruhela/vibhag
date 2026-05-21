import { DeviceEventEmitter } from 'react-native';

/**
 * Online-only version: no-op since all data operations interact directly with the backend API.
 */

export async function pushToCloud(): Promise<void> {
  // No-op: data is written directly to the backend
  console.log('[Sync] pushToCloud: no-op in online-only mode');
}

export async function pullFromCloud(): Promise<void> {
  // No-op: data is fetched directly from the backend
  console.log('[Sync] pullFromCloud: no-op in online-only mode');
  DeviceEventEmitter.emit('sync_complete');
}

export async function syncAll(): Promise<void> {
  console.log('[Sync] syncAll: no-op in online-only mode');
  await pushToCloud();
  await pullFromCloud();
}
