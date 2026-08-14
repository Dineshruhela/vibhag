/**
 * Centralized App Permissions Manager
 * Requests all required app permissions (Push Notifications, Media Library, Camera)
 * seamlessly together.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const PERMISSIONS_PROMPTED_KEY = 'vibhag_permissions_prompted_v1';

export interface PermissionStatusResults {
  notifications: boolean;
  mediaLibrary: boolean;
  camera: boolean;
}

/**
 * Request all app permissions at once.
 * @param force If true, forces prompt even if already requested on a previous launch.
 */
export async function requestAllAppPermissions(force: boolean = false): Promise<PermissionStatusResults> {
  if (Platform.OS === 'web') {
    return { notifications: false, mediaLibrary: false, camera: false };
  }

  try {
    const alreadyPrompted = await AsyncStorage.getItem(PERMISSIONS_PROMPTED_KEY);
    if (alreadyPrompted === 'true' && !force) {
      const [notif, media, cam] = await Promise.all([
        Notifications.getPermissionsAsync().catch(() => ({ status: 'undetermined' as const })),
        ImagePicker.getMediaLibraryPermissionsAsync().catch(() => ({ status: 'undetermined' as const })),
        ImagePicker.getCameraPermissionsAsync().catch(() => ({ status: 'undetermined' as const })),
      ]);

      return {
        notifications: notif.status === 'granted',
        mediaLibrary: media.status === 'granted',
        camera: cam.status === 'granted',
      };
    }

    await AsyncStorage.setItem(PERMISSIONS_PROMPTED_KEY, 'true');

    // 1. Notifications permission
    let notificationsGranted = false;
    try {
      const { status: existingNotif } = await Notifications.getPermissionsAsync();
      if (existingNotif === 'granted') {
        notificationsGranted = true;
      } else {
        const { status: newNotif } = await Notifications.requestPermissionsAsync({
          ios: {
            allowAlert: true,
            allowBadge: true,
            allowSound: true,
          },
        });
        notificationsGranted = newNotif === 'granted';
      }
    } catch (e) {
      console.warn('[Permissions] Notification request error:', e);
    }

    // 2. Photo Library / Gallery permission
    let mediaLibraryGranted = false;
    try {
      const { status: existingMedia } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (existingMedia === 'granted') {
        mediaLibraryGranted = true;
      } else {
        const { status: newMedia } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        mediaLibraryGranted = newMedia === 'granted';
      }
    } catch (e) {
      console.warn('[Permissions] Media library request error:', e);
    }

    // 3. Camera permission
    let cameraGranted = false;
    try {
      const { status: existingCam } = await ImagePicker.getCameraPermissionsAsync();
      if (existingCam === 'granted') {
        cameraGranted = true;
      } else {
        const { status: newCam } = await ImagePicker.requestCameraPermissionsAsync();
        cameraGranted = newCam === 'granted';
      }
    } catch (e) {
      console.warn('[Permissions] Camera request error:', e);
    }

    return {
      notifications: notificationsGranted,
      mediaLibrary: mediaLibraryGranted,
      camera: cameraGranted,
    };
  } catch (error) {
    console.error('[Permissions] Error requesting all permissions:', error);
    return { notifications: false, mediaLibrary: false, camera: false };
  }
}
