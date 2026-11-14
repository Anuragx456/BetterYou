import * as SystemUI from 'expo-system-ui';
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useSettingsStore, type ColorScheme } from '../store/useSettingsStore';
import { darkColors, lightColors, type ThemeColors } from './colors';

interface ThemeValue {
  colorScheme: ColorScheme;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeValue>({
  colorScheme: 'light',
  colors: lightColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useSettingsStore((state) => state.colorScheme);
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const value = useMemo(() => ({ colorScheme, colors }), [colorScheme, colors]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export function useThemeColors(): ThemeColors {
  return useContext(ThemeContext).colors;
}

export function useThemedStyles<T>(factory: (colors: ThemeColors) => T): T {
  const colors = useThemeColors();
  return useMemo(() => factory(colors), [colors, factory]);
}
