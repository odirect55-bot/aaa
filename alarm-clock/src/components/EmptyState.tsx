import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { AppButton } from './AppButton';

/** Shown when the alarm list is empty. */
export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { palette, spacing } = useTheme();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 4 }),
    ]).start();
  }, [fade, rise]);

  return (
    <Animated.View
      style={[styles.container, { padding: spacing.xl, opacity: fade, transform: [{ translateY: rise }] }]}
    >
      <View
        style={[
          styles.badge,
          { backgroundColor: palette.primarySoft, marginBottom: spacing.lg },
        ]}
      >
        <Text style={styles.badgeGlyph}>⏰</Text>
      </View>
      <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: palette.textSecondary, marginTop: spacing.sm }]}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <AppButton
          label={actionLabel}
          onPress={onAction}
          size="large"
          style={{ marginTop: spacing.xl, minWidth: 200 }}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  badgeGlyph: { fontSize: 44 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 300 },
});
