import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

/** Elevated content container used for list rows and form sections. */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { palette, radius, spacing, isDark } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.surface,
          borderRadius: radius.lg,
          borderColor: palette.border,
          padding: padded ? spacing.lg : 0,
          // A hairline border carries the elevation in dark mode, where drop
          // shadows are invisible.
          borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
          shadowOpacity: isDark ? 0 : 0.06,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#1B1B3A',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 2,
  },
});
