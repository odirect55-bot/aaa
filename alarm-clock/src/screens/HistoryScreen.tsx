import React from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { useAlarmStore } from '../state/AlarmStore';
import { useTheme } from '../theme/ThemeProvider';
import type { HistoryAction } from '../types/models';
import { formatDateTime } from '../utils/time';

const ACTION_COPY: Record<HistoryAction, string> = {
  dismissed: 'Dismissed',
  snoozed: 'Snoozed',
  missed: 'Missed',
};

export function HistoryScreen() {
  const { palette, radius, spacing } = useTheme();
  const { history, settings, clearHistory } = useAlarmStore();

  const confirmClear = () => {
    Alert.alert('Clear history?', 'All recorded alarm events will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => void clearHistory() },
    ]);
  };

  const toneFor = (action: HistoryAction) =>
    action === 'missed' ? palette.danger : action === 'snoozed' ? palette.warning : palette.success;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <FlatList
        data={history}
        keyExtractor={(entry) => entry.id}
        contentContainerStyle={[
          { padding: spacing.lg, gap: spacing.sm },
          history.length === 0 && styles.empty,
        ]}
        ListEmptyComponent={
          <EmptyState
            title="No history yet"
            message="Once an alarm rings, whether you dismiss it, snooze it or miss it shows up here."
          />
        }
        ListFooterComponent={
          history.length > 0 ? (
            <AppButton
              label="Clear history"
              variant="danger"
              fullWidth
              onPress={confirmClear}
              style={{ marginTop: spacing.lg }}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View
            style={[
              styles.row,
              {
                backgroundColor: palette.surface,
                borderRadius: radius.md,
                padding: spacing.lg,
                borderColor: palette.border,
              },
            ]}
          >
            <View style={styles.rowTexts}>
              <Text style={[styles.label, { color: palette.textPrimary }]} numberOfLines={1}>
                {item.label.trim().length > 0 ? item.label.trim() : 'Alarm'}
              </Text>
              <Text style={[styles.timestamp, { color: palette.textSecondary }]}>
                {formatDateTime(new Date(item.scheduledFor), settings.use24HourClock)}
              </Text>
            </View>
            <Text style={[styles.action, { color: toneFor(item.action) }]}>
              {ACTION_COPY[item.action]}
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { flexGrow: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowTexts: { flex: 1, gap: 2 },
  label: { fontSize: 15, fontWeight: '600' },
  timestamp: { fontSize: 13 },
  action: { fontSize: 13, fontWeight: '700' },
});
