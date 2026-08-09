import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { AD_UNIT_IDS } from '../constants/AdConfig';
import { getCurrentUser } from '../lib/database';

// Minimum time between App Open Ad presentations (4 hours)
const AD_COOLDOWN_MS = 4 * 60 * 60 * 1000;
let lastAdShownTimestamp = 0;

export function useAppOpenAd() {
  const appState = useRef(AppState.currentState);
  const isShowingAd = useRef(false);
  const isAdLoadingOrShowing = useRef(false);

  const showAppOpenAd = async () => {
    if (Platform.OS === 'web') return;

    // Check frequency cooldown
    const now = Date.now();
    if (now - lastAdShownTimestamp < AD_COOLDOWN_MS) {
      return;
    }

    try {
      // Don't show ads if user is not logged in or is Pro
      const user = await getCurrentUser().catch(() => null);
      if (!user || user.is_pro) {
        return;
      }

      if (isAdLoadingOrShowing.current) return;
      isAdLoadingOrShowing.current = true;

      const { AppOpenAd, AdEventType } = require('react-native-google-mobile-ads');
      const appOpenAd = AppOpenAd.createForAdRequest(AD_UNIT_IDS.appOpen, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubscribeLoaded = appOpenAd.addAdEventListener(
        AdEventType.LOADED,
        () => {
          isShowingAd.current = true;
          lastAdShownTimestamp = Date.now();
          appOpenAd.show();
        }
      );

      const unsubscribeClosed = appOpenAd.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          isShowingAd.current = false;
          lastAdShownTimestamp = Date.now();
          setTimeout(() => {
            isAdLoadingOrShowing.current = false;
          }, 2000);
          unsubscribeLoaded();
          unsubscribeClosed();
        }
      );

      const unsubscribeError = appOpenAd.addAdEventListener(
        AdEventType.ERROR,
        (error: any) => {
          console.warn('[AppOpenAd] Failed to load/show ad:', error);
          isShowingAd.current = false;
          isAdLoadingOrShowing.current = false;
          unsubscribeLoaded();
          unsubscribeError();
        }
      );

      appOpenAd.load();
    } catch (e) {
      console.warn('[AppOpenAd] Error initializing App Open Ad:', e);
      isAdLoadingOrShowing.current = false;
    }
  };

  useEffect(() => {
    // Show ad on initial app load if user is logged in
    showAppOpenAd();

    // Show ad when app comes back to active state from background
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        !isShowingAd.current
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
