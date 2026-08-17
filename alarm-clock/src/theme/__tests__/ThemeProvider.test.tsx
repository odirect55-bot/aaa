import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

const mockColorScheme = jest.fn<'light' | 'dark' | null, []>(() => 'light');

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockColorScheme(),
}));

import { ThemeProvider, useTheme } from '../ThemeProvider';
import { darkPalette, lightPalette } from '../tokens';

function Probe() {
  const { palette, isDark } = useTheme();
  return <Text testID="probe">{`${isDark ? 'dark' : 'light'}:${palette.background}`}</Text>;
}

async function renderWithMode(mode: 'system' | 'light' | 'dark') {
  await render(
    <ThemeProvider mode={mode}>
      <Probe />
    </ThemeProvider>
  );
  return screen.getByTestId('probe').props.children as string;
}

describe('ThemeProvider', () => {
  it('uses the light palette when the user picks light', async () => {
    mockColorScheme.mockReturnValue('dark');
    expect(await renderWithMode('light')).toBe(`light:${lightPalette.background}`);
  });

  it('uses the dark palette when the user picks dark', async () => {
    mockColorScheme.mockReturnValue('light');
    expect(await renderWithMode('dark')).toBe(`dark:${darkPalette.background}`);
  });

  it('follows the system scheme when set to system', async () => {
    mockColorScheme.mockReturnValue('dark');
    expect(await renderWithMode('system')).toBe(`dark:${darkPalette.background}`);

    mockColorScheme.mockReturnValue('light');
    expect(await renderWithMode('system')).toBe(`light:${lightPalette.background}`);
  });

  it('falls back to light when the system scheme is unknown', async () => {
    mockColorScheme.mockReturnValue(null);
    expect(await renderWithMode('system')).toBe(`light:${lightPalette.background}`);
  });

  it('defines every palette token in both themes', () => {
    const lightKeys = Object.keys(lightPalette).sort();
    const darkKeys = Object.keys(darkPalette).sort();
    expect(darkKeys).toEqual(lightKeys);

    for (const key of lightKeys) {
      expect(lightPalette[key as keyof typeof lightPalette]).toMatch(/^(#|rgba)/);
      expect(darkPalette[key as keyof typeof darkPalette]).toMatch(/^(#|rgba)/);
    }
  });
});
