import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { getSoundName } from '../constants/sounds';
import { useTheme } from '../theme/ThemeProvider';
import type { Alarm } from '../types/models';
import { formatCountdown, formatMeridiem, formatRelativeDay, formatRepeatDays, formatTime, nextOccurrence } from '../utils/time';

/** One row in the alarm list: time, metadata and the on/off switch. */
export function AlarmCard({
  alarm,
  use24HourClock,
  isNext,
  now,
  onPress,
  onToggle,
  onLongPress,
}: {
  alarm: Alarm;
  use24HourClock: boolean;
  isNext: boolean;
  now: Date;
  onPress: () => void;
  onToggle: (enabled: boolean) => void;
  onLongPress: () => void;
}) {
  const { palette, radius, spacing, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const upcoming = alarm.enabled ? nextOccurrence(alarm, now) : null;
  const time = formatTime(alarm.hour, alarm.minute, use24HourClock);
  const meridiem = use24HourClock ? null : formatMeridiem(alarm.hour);

  // One canonical spoken name for the alarm, reused by the card and its switch
  // so a screen reader announces them distinctly rather than twice over.
  const spokenName = `${alarm.label.trim() || 'Alarm'} at ${time}${meridiem ? ` ${meridiem}` : ''}`;

  const metadata = [
    formatRepeatDays(alarm.repeatDays),
    getSoundName(alarm.soundId),
    alarm.vibrate ? 'Vibrate' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const animate = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 3 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${spokenName}, ${formatRepeatDays(alarm.repeatDays)}`}
        accessibilityHint="Opens the alarm for editing. Long press to delete."
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={() => animate(0.98)}
        onPressOut={() => animate(1)}
        style={[
          styles.card,
          {
            backgroundColor: palette.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            borderWidth: isNext ? 1.5 : isDark ? StyleSheet.hairlineWidth : 0,
            borderColor: isNext ? palette.primary : palette.border,
            shadowOpacity: isDark ? 0 : 0.05,
            opacity: alarm.enabled ? 1 : 0.55,
          },
        ]}
      >
        <View style={styles.main}>
          <View style={styles.details}>
            <View style={styles.timeRow}>
              <Text
                style={[styles.time, { color: palette.textPrimary }]}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {time}
              </Text>
              {meridiem ? (
                <Text style={[styles.meridiem, { color: palette.textSecondary }]}>{meridiem}</Text>
              ) : null}
            </View>

            {alarm.label.trim().length > 0 ? (
              <Text style={[styles.label, { color: palette.textPrimary }]} numberOfLines={1}>
                {alarm.label.trim()}
              </Text>
            ) : null}

            <Text style={[styles.metadata, { color: palette.textSecondary }]} numberOfLines={1}>
              {metadata}
            </Text>
          </View>

          <Switch
            accessibilityLabel={`Enable ${spokenName}`}
            accessibilityHint={alarm.enabled ? 'Turns this alarm off' : 'Turns this alarm on'}
            accessibilityRole="switch"
            accessibilityState={{ checked: alarm.enabled }}
            value={alarm.enabled}
            onValueChange={onToggle}
            trackColor={{ false: palette.switchTrackOff, true: palette.primary }}
            thumbColor={palette.switchThumb}
          />
        </View>

        {upcoming ? (
          <View
            style={[
              styles.footer,
              { borderTopColor: palette.border, marginTop: spacing.md, paddingTop: spacing.md },
            ]}
          >
            <Text
              style={[
                styles.upcoming,
                { color: isNext ? palette.primary : palette.textMuted },
              ]}
            >
              {isNext ? '● Next · ' : ''}
              {formatRelativeDay(upcoming, now)} · {formatCountdown(upcoming, now)}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#1B1B3A',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  main: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  details: { flex: 1, gap: 2 },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  time: { fontSize: 44, fontWeight: '300', letterSpacing: -1.5 },
  meridiem: { fontSize: 17, fontWeight: '600' },
  label: { fontSize: 15, fontWeight: '600' },
  metadata: { fontSize: 13 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  upcoming: { fontSize: 13, fontWeight: '600' },
});
