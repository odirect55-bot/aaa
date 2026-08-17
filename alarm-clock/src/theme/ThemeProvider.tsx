import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import type { ThemeMode } from '../types/models';
import { darkPalette, lightPalette, radius, spacing, typography, type Palette } from './tokens';

export interface Theme {
  palette: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  isDark: boolean;
}

const ThemeContext = createContext<Theme>({
  palette: lightPalette,
  spacing,
  radius,
  typography,
  isDark: false,
});

export function ThemeProvider({
  mode,
  children,
}: {
  mode: ThemeMode;
  children: React.ReactNode;
}) {
  const systemScheme = useColorScheme();
  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  const value = useMemo<Theme>(
    () => ({
      palette: isDark ? darkPalette : lightPalette,
      spacing,
      radius,
      typography,
      isDark,
    }),
    [isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
