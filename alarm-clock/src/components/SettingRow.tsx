import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import { MIN_TOUCH_TARGET } from '../theme/tokens';

interface BaseProps {
  title: string;
  subtitle?: string;
  /** Right-hand value text, e.g. the current selection. */
  value?: string;
  disabled?: boolean;
}

/** A tappable settings row that opens a picker or navigates onwards. */
export function SettingRow({
  title,
  subtitle,
  value,
  onPress,
  disabled,
  destructive,
}: BaseProps & { onPress: () => void; destructive?: boolean }) {
  const { palette, spacing } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityValue={value ? { text: value } : undefined}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingVertical: spacing.md,
          opacity: disabled ? 0.4 : 1,
          backgroundColor: pressed ? palette.surfaceSubtle : 'transparent',
        },
      ]}
    >
      <View style={styles.texts}>
        <Text
          style={[styles.title, { color: destructive ? palette.danger : palette.textPrimary }]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.value, { color: palette.textSecondary }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** A settings row backed by a switch. */
export function SwitchRow({
  title,
  subtitle,
  checked,
  onChange,
  disabled,
}: BaseProps & { checked: boolean; onChange: (next: boolean) => void }) {
  const { palette, spacing } = useTheme();

  return (
    <View style={[styles.row, { paddingVertical: spacing.md, opacity: disabled ? 0.4 : 1 }]}>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={checked}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: palette.switchTrackOff, true: palette.primary }}
        thumbColor={palette.switchThumb}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
    gap: 16,
    paddingHorizontal: 4,
  },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '500' },
  subtitle: { fontSize: 13, lineHeight: 18 },
  value: { fontSize: 15, fontWeight: '500', maxWidth: 140, textAlign: 'right' },
});
