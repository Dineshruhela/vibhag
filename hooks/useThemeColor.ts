/**
 * useThemeColor - resolves color based on current theme
 */
import { Colors } from '@/constants/Colors';
import { useColorScheme } from './useColorScheme';

export function useThemeColor(
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark,
  props?: { light?: string; dark?: string }
) {
  const theme = useColorScheme();
  const colorFromProps = props?.[theme];

  if (colorFromProps) {
    return colorFromProps;
  }
  return Colors[theme][colorName];
}

export function useThemeColors() {
  const theme = useColorScheme();
  return Colors[theme];
}
