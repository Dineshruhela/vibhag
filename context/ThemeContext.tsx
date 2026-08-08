import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  themeMode: ThemeMode;
  colorScheme: 'dark' | 'light';
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = '@splitmaro_theme_mode';

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'dark',
  colorScheme: 'dark',
  setThemeMode: () => {},
  toggleTheme: () => {},
});

export function ThemeProviderCustom({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useRNColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then(stored => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeModeState(stored as ThemeMode);
      }
    });
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    DeviceEventEmitter.emit('theme_change', mode);
  };

  const activeColorScheme: 'dark' | 'light' =
    themeMode === 'system' ? (systemColorScheme ?? 'dark') : themeMode;

  const toggleTheme = () => {
    const nextMode = activeColorScheme === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        colorScheme: activeColorScheme,
        setThemeMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext() {
  return useContext(ThemeContext);
}
