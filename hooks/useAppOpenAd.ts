import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { AD_UNIT_IDS } from '../constants/AdConfig';
import { getCurrentUser } from '../lib/database';

export function useAppOpenAd() {
  const appState = useRef(AppState.currentState);
  const isShowingAd = useRef(false);

  const showAppOpenAd = async () => {
    if (Platform.OS === 'web') return;

    try {
      const { AppOpenAd, AdEventType } = require('react-native-google-mobile-ads');
      // Don't show ads for Pro users
      const user = await getCurrentUser().catch(() => null);
      if (user?.is_pro) {
        return;
      }

      if (isShowingAd.current) return;

      const appOpenAd = AppOpenAd.createForAdRequest(AD_UNIT_IDS.appOpen, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubscribeLoaded = appOpenAd.addAdEventListener(
        AdEventType.LOADED,
        () => {
          isShowingAd.current = true;
          appOpenAd.show();
        }
      );

      const unsubscribeClosed = appOpenAd.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          isShowingAd.current = false;
          unsubscribeLoaded();
          unsubscribeClosed();
        }
      );

      const unsubscribeError = appOpenAd.addAdEventListener(
        AdEventType.ERROR,
        (error: any) => {
          console.warn('[AppOpenAd] Failed to load/show ad:', error);
          isShowingAd.current = false;
          unsubscribeLoaded();
          unsubscribeError();
        }
      );

      appOpenAd.load();
    } catch (e) {
      console.warn('[AppOpenAd] Error initializing App Open Ad:', e);
    }
  };

  useEffect(() => {
    // Show ad on initial app load
    showAppOpenAd();

    // Show ad when app comes back to active state from background
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        showAppOpenAd();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
