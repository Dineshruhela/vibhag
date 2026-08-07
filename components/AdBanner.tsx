import React, { useEffect, useState } from 'react';
import { View, Platform, DeviceEventEmitter } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { getCurrentUser } from '../lib/database';

// Replace with real Ad Unit IDs before production.
const adUnitId = __DEV__ 
  ? TestIds.BANNER 
  : (Platform.OS === 'ios' ? 'ca-app-pub-3940256099942544~1458002511' : 'ca-app-pub-3940256099942544~3347511713');

export function AdBanner() {
  const [isPro, setIsPro] = useState<boolean | null>(null);

  const checkProStatus = async () => {
    try {
      const user = await getCurrentUser();
      setIsPro(!!user?.is_pro);
    } catch (e) {
      setIsPro(false);
    }
  };

  useEffect(() => {
    checkProStatus();
    
    // Re-check if auth state changes (e.g. after a purchase)
    const authSub = DeviceEventEmitter.addListener('auth_change', checkProStatus);
    const purchaseSub = DeviceEventEmitter.addListener('pro_upgrade_success', checkProStatus);
    return () => {
      authSub.remove();
      purchaseSub.remove();
    };
  }, []);

  // If loading or if the user is a pro, don't show the ad
  if (isPro === null || isPro === true) {
    return null;
  }

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%', marginVertical: 8 }}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
}
