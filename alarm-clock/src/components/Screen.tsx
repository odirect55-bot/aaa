import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '../theme/ThemeProvider';

/** Background + safe-area wrapper shared by every screen. */
export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  style,
  background,
}: {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
  background?: string;
}) {
  const { palette } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: background ?? palette.background }]}>
      <SafeAreaView edges={edges} style={[styles.root, style]}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
