/**
 * Splitmaro Design System Colors — v2
 * Premium palette with gradient support, elevation surfaces, glass tokens
 */

const tintColorLight = '#00C48C';
const tintColorDark = '#00E5A8';

export const Colors = {
  light: {
    // Core brand
    primary: '#7C5CFC', // Deep Purple
    primaryLight: '#322566',
    primaryDark: '#5E46C2',
    primaryGradientStart: '#7C5CFC',
    primaryGradientEnd: '#9D82F5',

    // Accent
    accent: '#FF6B6B', // Coral CTA
    accentLight: '#4A2A2A',
    premium: '#F7D65A', // Gold for Pro
    premiumLight: '#3A321A',

    // Semantic
    negative: '#FF6B6B',
    negativeLight: '#2D1F1F',
    negativeGradient: '#FF5252',
    positive: '#00D4B8', // Teal
    positiveLight: '#123D3A',

    // Neutrals
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    textInverse: '#12121D',

    // Elevation surfaces
    background: '#12121D',
    surface: '#1E1E2D',
    surface1: '#1E1E2D',
    surface2: '#252538',
    surface3: '#2A2A3E',
    surfaceSecondary: '#242436',

    // Glass / blur overlay tokens
    glass: 'rgba(30, 30, 45, 0.72)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    scrim: 'rgba(0, 0, 0, 0.75)',

    // UI
    border: 'rgba(255, 255, 255, 0.1)',
    borderLight: 'rgba(255, 255, 255, 0.05)',
    icon: '#94A3B8',
    tabIconDefault: '#4B5563',
    tabIconSelected: '#7C5CFC',
    tint: '#7C5CFC',

    // Status
    success: '#00D4B8',
    successLight: '#123D3A',
    warning: '#FBBF24',
    warningLight: '#3A2E10',
    error: '#FF6B6B',
    errorLight: '#2D1F1F',
    info: '#60A5FA',
    infoLight: '#172740',

    // Shadows
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowMedium: 'rgba(0, 0, 0, 0.5)',
    shadowLarge: 'rgba(0, 0, 0, 0.7)',
    shadowColor: '#000000',
  },
  dark: {
    // Core brand
    primary: '#7C5CFC', // Deep Purple
    primaryLight: '#322566',
    primaryDark: '#5E46C2',
    primaryGradientStart: '#7C5CFC',
    primaryGradientEnd: '#9D82F5',

    // Accent
    accent: '#FF6B6B', // Coral CTA
    accentLight: '#4A2A2A',
    premium: '#F7D65A', // Gold for Pro
    premiumLight: '#3A321A',

    // Semantic
    negative: '#FF6B6B',
    negativeLight: '#2D1F1F',
    negativeGradient: '#FF5252',
    positive: '#00D4B8', // Teal
    positiveLight: '#123D3A',

    // Neutrals
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    textInverse: '#12121D',

    // Elevation surfaces
    background: '#12121D',
    surface: '#1E1E2D',
    surface1: '#1E1E2D',
    surface2: '#252538',
    surface3: '#2A2A3E',
    surfaceSecondary: '#242436',

    // Glass / blur overlay tokens
    glass: 'rgba(30, 30, 45, 0.72)',
    glassBorder: 'rgba(255, 255, 255, 0.08)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    scrim: 'rgba(0, 0, 0, 0.75)',

    // UI
    border: 'rgba(255, 255, 255, 0.1)',
    borderLight: 'rgba(255, 255, 255, 0.05)',
    icon: '#94A3B8',
    tabIconDefault: '#4B5563',
    tabIconSelected: '#7C5CFC',
    tint: '#7C5CFC',

    // Status
    success: '#00D4B8',
    successLight: '#123D3A',
    warning: '#FBBF24',
    warningLight: '#3A2E10',
    error: '#FF6B6B',
    errorLight: '#2D1F1F',
    info: '#60A5FA',
    infoLight: '#172740',

    // Shadows
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowMedium: 'rgba(0, 0, 0, 0.5)',
    shadowLarge: 'rgba(0, 0, 0, 0.7)',
    shadowColor: '#000000',
  },
};

// Expense categories with icons and colors
export const CategoryColors: Record<string, { color: string; icon: string }> = {
  food: { color: '#FF6B35', icon: 'restaurant' },
  transport: { color: '#4ECDC4', icon: 'car' },
  shopping: { color: '#FF69B4', icon: 'cart' },
  entertainment: { color: '#9B59B6', icon: 'game-controller' },
  utilities: { color: '#3498DB', icon: 'flash' },
  rent: { color: '#E74C3C', icon: 'home' },
  travel: { color: '#1ABC9C', icon: 'airplane' },
  health: { color: '#2ECC71', icon: 'medkit' },
  education: { color: '#F39C12', icon: 'school' },
  general: { color: '#95A5A6', icon: 'receipt' },
};

// Group category colors
export const GroupCategoryColors: Record<string, { color: string; icon: string; emoji: string }> = {
  trip: { color: '#1ABC9C', icon: 'airplane', emoji: '✈️' },
  home: { color: '#E74C3C', icon: 'home', emoji: '🏠' },
  couple: { color: '#FF69B4', icon: 'heart', emoji: '❤️' },
  friends: { color: '#3498DB', icon: 'people', emoji: '👥' },
  work: { color: '#F39C12', icon: 'briefcase', emoji: '💼' },
  other: { color: '#95A5A6', icon: 'ellipsis-horizontal', emoji: '📦' },
};

// Avatar colors for users
export const AvatarColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F0B27A', '#82E0AA',
  '#F1948A', '#AED6F1', '#D2B4DE', '#A3E4D7',
];
