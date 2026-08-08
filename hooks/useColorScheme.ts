/**
 * useColorScheme hook - determines current color scheme dynamically from ThemeContext
 */
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useThemeContext } from '../context/ThemeContext';

export function useColorScheme(): 'dark' | 'light' {
  try {
    const context = useThemeContext();
    if (context && context.colorScheme) {
      return context.colorScheme;
    }
  } catch (e) {
    // Fallback if rendered outside ThemeProvider
  }
  const rnScheme = useRNColorScheme();
  return rnScheme ?? 'dark';
}
