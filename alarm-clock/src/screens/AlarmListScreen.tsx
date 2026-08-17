import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { AlarmCard } from '../components/AlarmCard';
import { EmptyState } from '../components/EmptyState';
import { NoticeBanner } from '../components/NoticeBanner';
import { Screen } from '../components/Screen';
import type { RootScreenProps } from '../navigation/types';
import { openAppSettings } from '../services/notifications';
import { useAlarmStore } from '../state/AlarmStore';
import { useTheme } from '../theme/ThemeProvider';
import type { Alarm } from '../types/models';
import {
  findNextAlarm,
  formatCountdown,
  formatMeridiem,
  formatRelativeDay,
  formatTime,
  nextOccurrence,
  toMinutesOfDay,
} from '../utils/time';

/** Enabled alarms first, ordered by when they will actually ring. */
function sortAlarms(alarms: Alarm[], now: Date): Alarm[] {
  return [...alarms].sort((a, b) => {
    if (a.enabled !== b.enabled) {
      return a.enabled ? -1 : 1;
    }
    if (a.enabled && b.enabled) {
      const nextA = nextOccurrence(a, now);
      const nextB = nextOccurrence(b, now);
      if (nextA && nextB && nextA.getTime() !== nextB.getTime()) {
        return nextA.getTime() - nextB.getTime();
      }
    }
    return toMinutesOfDay(a.hour, a.minute) - toMinutesOfDay(b.hour, b.minute);
  });
}

export function AlarmListScreen({ navigation }: RootScreenProps<'AlarmList'>) {
  const { palette, radius, spacing } = useTheme();
  const { alarms, settings, permission, ready, lastSyncError, setAlarmEnabled, deleteAlarm, requestPermission } =
    useAlarmStore();

  // Drives the live countdowns without re-rendering more than once a minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(interval);
  }, []);

  const sorted = useMemo(() => sortAlarms(alarms, now), [alarms, now]);
  const next = useMemo(() => findNextAlarm(alarms, now), [alarms, now]);

  const confirmDelete = useCallback(
    (alarm: Alarm) => {
      Alert.alert(
        'Delete alarm?',
        `${formatTime(alarm.hour, alarm.minute, settings.use24HourClock)}${
          settings.use24HourClock ? '' : ` ${formatMeridiem(alarm.hour)}`
        }${alarm.label ? ` · ${alarm.label}` : ''}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void deleteAlarm(alarm.id);
            },
          },
        ]
      );
    },
    [deleteAlarm, settings.use24HourClock]
  );

  const header = (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.title, { color: palette.textPrimary }]}>Alarms</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            {next
              ? `Next ${formatRelativeDay(next.date, now).toLowerCase()} at ${formatTime(
                  next.date.getHours(),
                  next.date.getMinutes(),
                  settings.use24HourClock
                )}${settings.use24HourClock ? '' : ` ${formatMeridiem(next.date.getHours())}`} · ${formatCountdown(next.date, now)}`
              : alarms.length > 0
                ? 'No alarms are switched on'
                : 'Nothing scheduled yet'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          onPress={() => navigation.navigate('Settings')}
          hitSlop={10}
          style={({ pressed }) => [
            styles.iconButton,
            {
              backgroundColor: pressed ? palette.surfaceSubtle : palette.surface,
              borderRadius: radius.pill,
              borderColor: palette.border,
            },
          ]}
        >
          <Text style={styles.iconGlyph}>⚙︎</Text>
        </Pressable>
      </View>

      {!permission.granted && ready ? (
        <NoticeBanner
          tone="danger"
          title="Notifications are off"
          message="Alarms cannot ring without notification permission. Turn it on so scheduled alarms reach you."
          actionLabel={permission.canAskAgain ? 'Allow notifications' : 'Open settings'}
          onAction={() => {
            if (permission.canAskAgain) {
              void requestPermission();
            } else {
              void openAppSettings();
            }
          }}
        />
      ) : null}

      {lastSyncError ? (
        <NoticeBanner tone="warning" title="Scheduling problem" message={lastSyncError} />
      ) : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={sorted}
        keyExtractor={(alarm) => alarm.id}
        contentContainerStyle={[
          styles.list,
          { padding: spacing.lg, paddingBottom: 120, gap: spacing.md },
          sorted.length === 0 && styles.listEmpty,
        ]}
        ListHeaderComponent={header}
        ListHeaderComponentStyle={{ marginBottom: spacing.lg }}
        ListEmptyComponent={
          ready ? (
            <EmptyState
              title="No alarms yet"
              message="Create your first alarm and it will ring even if the app is closed."
              actionLabel="Create alarm"
              onAction={() => navigation.navigate('AlarmEdit', {})}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <AlarmCard
            alarm={item}
            now={now}
            use24HourClock={settings.use24HourClock}
            isNext={next?.alarm.id === item.id}
            onPress={() => navigation.navigate('AlarmEdit', { alarmId: item.id })}
            onToggle={(enabled) => {
              void setAlarmEnabled(item.id, enabled);
            }}
            onLongPress={() => confirmDelete(item)}
          />
        )}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add alarm"
        onPress={() => navigation.navigate('AlarmEdit', {})}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: pressed ? palette.primaryPressed : palette.primary,
            shadowColor: palette.primary,
          },
        ]}
      >
        <Text style={[styles.fabGlyph, { color: palette.onPrimary }]}>+</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1 },
  listEmpty: { justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 14, marginTop: 4, maxWidth: 260 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconGlyph: { fontSize: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 32,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabGlyph: { fontSize: 34, lineHeight: 38, fontWeight: '300' },
});
