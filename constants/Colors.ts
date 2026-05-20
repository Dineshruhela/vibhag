/**
 * Vibhag Design System Colors
 * Splitwise-inspired color palette with premium dark/light modes
 */

const tintColorLight = '#1CC29F';
const tintColorDark = '#1CC29F';

export const Colors = {
  light: {
    // Core
    primary: '#1CC29F',
    primaryLight: '#E8F8F4',
    primaryDark: '#15967B',
    
    // Semantic
    negative: '#FF6B6B',    // "You owe"
    negativeLight: '#FFF0F0',
    positive: '#5C6BC0',    // "You are owed"
    positiveLight: '#ECEFFE',
    
    // Neutrals
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    
    // Surfaces
    background: '#F5F7FA',
    surface: '#FFFFFF',
    surfaceSecondary: '#F0F2F5',
    
    // UI
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    icon: '#6B7280',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorLight,
    tint: tintColorLight,
    
    // Status
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    
    // Shadows
    shadow: 'rgba(0, 0, 0, 0.08)',
    shadowMedium: 'rgba(0, 0, 0, 0.12)',
  },
  dark: {
    // Core
    primary: '#1CC29F',
    primaryLight: '#1A2F2A',
    primaryDark: '#25E8BF',
    
    // Semantic
    negative: '#FF6B6B',
    negativeLight: '#2D1F1F',
    positive: '#7C8AE5',
    positiveLight: '#1E2142',
    
    // Neutrals
    text: '#F9FAFB',
    textSecondary: '#9CA3AF',
    textTertiary: '#6B7280',
    
    // Surfaces
    background: '#0F1419',
    surface: '#1A2332',
    surfaceSecondary: '#243044',
    
    // UI
    border: '#2D3748',
    borderLight: '#1F2937',
    icon: '#9CA3AF',
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorDark,
    tint: tintColorDark,
    
    // Status
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
    
    // Shadows
    shadow: 'rgba(0, 0, 0, 0.3)',
    shadowMedium: 'rgba(0, 0, 0, 0.5)',
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
