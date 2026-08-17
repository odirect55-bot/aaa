import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

/** Compact single-choice control used for theme and clock format. */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (next: T) => void;
  accessibilityLabel?: string;
}) {
  const { palette, radius } = useTheme();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.container,
        { backgroundColor: palette.surfaceSubtle, borderRadius: radius.md },
      ]}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={segment.label}
            onPress={() => onChange(segment.value)}
            style={[
              styles.segment,
              {
                borderRadius: radius.md - 3,
                backgroundColor: selected ? palette.surface : 'transparent',
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: selected ? palette.textPrimary : palette.textSecondary },
              ]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', padding: 3, gap: 2 },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  label: { fontSize: 14, fontWeight: '600' },
});
