import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

type Tone = 'warning' | 'danger' | 'info';

/**
 * Inline banner for conditions the user has to know about: notifications
 * turned off, a scheduling failure, battery restrictions.
 */
export function NoticeBanner({
  tone = 'warning',
  title,
  message,
  actionLabel,
  onAction,
}: {
  tone?: Tone;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { palette, radius, spacing } = useTheme();

  const accent =
    tone === 'danger' ? palette.danger : tone === 'info' ? palette.primary : palette.warning;
  const background =
    tone === 'danger'
      ? palette.dangerSoft
      : tone === 'info'
        ? palette.primarySoft
        : palette.surfaceSubtle;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        { backgroundColor: background, borderRadius: radius.md, padding: spacing.lg, borderLeftColor: accent },
      ]}
    >
      <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: palette.textSecondary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={styles.action}
          hitSlop={8}
        >
          <Text style={[styles.actionLabel, { color: accent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderLeftWidth: 3, gap: 4 },
  title: { fontSize: 15, fontWeight: '700' },
  message: { fontSize: 13, lineHeight: 19 },
  action: { marginTop: 6, minHeight: 32, justifyContent: 'center' },
  actionLabel: { fontSize: 14, fontWeight: '700' },
});
