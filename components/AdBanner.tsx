import React, { useState } from 'react';
import { View, Platform } from 'react-native';
import { AD_UNIT_IDS } from '../constants/AdConfig';

export function AdBanner() {
  if (Platform.OS === 'web') {
    return null;
  }

  const GoogleMobileAds = require('react-native-google-mobile-ads');
  const BannerAd = GoogleMobileAds.BannerAd;
  const BannerAdSize = GoogleMobileAds.BannerAdSize;
  const TestIds = GoogleMobileAds.TestIds;

  const [currentUnitId, setCurrentUnitId] = useState<string>(AD_UNIT_IDS.banner);

  if (!BannerAd) return null;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%', marginVertical: 8, minHeight: 50 }}>
      <BannerAd
        unitId={currentUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error: any) => {
          console.warn('[AdBanner] Failed to load ad unit:', currentUnitId, error);
          if (currentUnitId !== TestIds.BANNER) {
            console.log('[AdBanner] Falling back to Google Test Banner ID for TestFlight...');
            setCurrentUnitId(TestIds.BANNER);
          }
        }}
      />
    </View>
  );
}
