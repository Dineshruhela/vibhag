/**
 * useColorScheme hook - determines current color scheme
 */
import { useColorScheme as useRNColorScheme } from 'react-native';

export function useColorScheme() {
  return useRNColorScheme() ?? 'dark';
}
