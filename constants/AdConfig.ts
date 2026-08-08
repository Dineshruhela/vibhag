import { Platform } from 'react-native';

const TEST_BANNER = 'ca-app-pub-3940256099942544/2934735446';
const TEST_NATIVE = 'ca-app-pub-3940256099942544/2247696110';
const TEST_APP_OPEN = 'ca-app-pub-3940256099942544/5635727612';

export const ADMOB_APP_IDS = {
  ios: 'ca-app-pub-2203210311587761~6904181628',
  android: 'ca-app-pub-2203210311587761~4295551345',
};

export const AD_UNIT_IDS = {
  banner: __DEV__ 
    ? TEST_BANNER 
    : (Platform.OS === 'ios' ? 'ca-app-pub-2203210311587761/3174041362' : 'ca-app-pub-2203210311587761/7834119922'),
  native: __DEV__ 
    ? TEST_NATIVE 
    : (Platform.OS === 'ios' ? 'ca-app-pub-2203210311587761/2846738301' : 'ca-app-pub-2203210311587761/7834119922'),
  appOpen: __DEV__
    ? TEST_APP_OPEN
    : (Platform.OS === 'ios' ? 'ca-app-pub-2203210311587761/2846738301' : 'ca-app-pub-2203210311587761/1477816317'),
};
