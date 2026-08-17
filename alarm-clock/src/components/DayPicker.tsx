import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeProvider';
import type { Weekday } from '../types/models';
import { DAY_LABELS_LONG, DAY_LABELS_SHORT } from '../utils/time';

const ORDERED_DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 0]; // Monday-first

const PRESETS: { label: string; days: Weekday[] }[] = [
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] },
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Weekends', days: [0, 6] },
  { label: 'Once', days: [] },
];

function sameSet(a: Weekday[], b: Weekday[]): boolean {
  return a.length === b.length && [...a].sort().every((day, index) => day === [...b].sort()[index]);
}

/** Day-of-week selector with the common presets above it. */
export function DayPicker({
  value,
  onChange,
}: {
  value: Weekday[];
  onChange: (next: Weekday[]) => void;
}) {
  const { palette, radius, spacing } = useTheme();

  const toggle = (day: Weekday) => {
    onChange(value.includes(day) ? value.filter((item) => item !== day) : [...value, day].sort());
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.presets}>
        {PRESETS.map((preset) => {
          const selected = sameSet(value, preset.days);
          return (
            <Pressable
              key={preset.label}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Repeat ${preset.label}`}
              onPress={() => onChange([...preset.days])}
              style={[
                styles.preset,
                {
                  borderRadius: radius.pill,
                  backgroundColor: selected ? palette.primarySoft : palette.surfaceSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetLabel,
                  { color: selected ? palette.primary : palette.textSecondary },
                ]}
              >
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.days}>
        {ORDERED_DAYS.map((day) => {
          const selected = value.includes(day);
          return (
            <Pressable
              key={day}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={DAY_LABELS_LONG[day]}
              onPress={() => toggle(day)}
              style={[
                styles.day,
                {
                  backgroundColor: selected ? palette.primary : palette.surfaceSubtle,
                  borderColor: selected ? palette.primary : palette.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.dayLabel,
                  { color: selected ? palette.onPrimary : palette.textSecondary },
                ]}
              >
                {DAY_LABELS_SHORT[day]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center' },
  presetLabel: { fontSize: 13, fontWeight: '600' },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  day: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 52,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: { fontSize: 15, fontWeight: '700' },
});
