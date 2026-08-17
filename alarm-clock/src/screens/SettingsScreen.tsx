import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { NoticeBanner } from '../components/NoticeBanner';
import { OptionSheet, type SheetOption } from '../components/OptionSheet';
import { Screen } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { SettingRow, SwitchRow } from '../components/SettingRow';
import { ALARM_SOUNDS, getSoundName } from '../constants/sounds';
import type { RootScreenProps } from '../navigation/types';
import { previewSound, stopPreview } from '../services/alarmAudio';
import {
  openAppSettings,
  openBatteryOptimizationSettings,
  openExactAlarmSettings,
} from '../services/notifications';
import { useAlarmStore } from '../state/AlarmStore';
import { useTheme } from '../theme/ThemeProvider';
import type { SoundId, ThemeMode } from '../types/models';
import { SNOOZE_OPTIONS } from '../types/models';

const SOUND_OPTIONS: SheetOption<SoundId>[] = ALARM_SOUNDS.map((sound) => ({
  value: sound.id,
  label: sound.name,
  description: sound.description,
}));

const SNOOZE_SHEET_OPTIONS: SheetOption<number>[] = SNOOZE_OPTIONS.filter(
  (minutes) => minutes > 0
).map((minutes) => ({ value: minutes, label: `${minutes} minutes` }));

const AUTO_DISMISS_OPTIONS: SheetOption<number>[] = [1, 2, 5, 10, 15, 30].map((minutes) => ({
  value: minutes,
  label: `${minutes} minute${minutes === 1 ? '' : 's'}`,
}));

export function SettingsScreen({ navigation }: RootScreenProps<'Settings'>) {
  const { palette, spacing } = useTheme();
  const {
    settings,
    permission,
    alarms,
    history,
    updateSettings,
    requestPermission,
    refreshPermission,
    resetAllData,
    resync,
  } = useAlarmStore();

  const [soundSheet, setSoundSheet] = useState(false);
  const [snoozeSheet, setSnoozeSheet] = useState(false);
  const [autoDismissSheet, setAutoDismissSheet] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  useEffect(() => {
    void refreshPermission();
    return stopPreview;
  }, [refreshPermission]);

  const handleResync = useCallback(async () => {
    setResyncing(true);
    try {
      await resync();
      Alert.alert('Alarms rescheduled', 'Every enabled alarm has been re-registered with Android.');
    } finally {
      setResyncing(false);
    }
  }, [resync]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Erase all data?',
      'Every alarm, setting and history entry on this device will be deleted and all scheduled alarms cancelled. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: () => {
            void resetAllData();
          },
        },
      ]
    );
  }, [resetAllData]);

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}
      >
        {!permission.granted ? (
          <NoticeBanner
            tone="danger"
            title="Notifications are off"
            message="Android delivers alarms as notifications. Without this permission nothing will ring."
            actionLabel={permission.canAskAgain ? 'Allow notifications' : 'Open system settings'}
            onAction={() => {
              if (permission.canAskAgain) {
                void requestPermission();
              } else {
                void openAppSettings();
              }
            }}
          />
        ) : null}

        <Card padded={false}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>
              DEFAULTS FOR NEW ALARMS
            </Text>
            <SettingRow
              title="Alarm sound"
              value={getSoundName(settings.defaultSoundId)}
              onPress={() => setSoundSheet(true)}
            />
            <SettingRow
              title="Snooze length"
              value={`${settings.defaultSnoozeMinutes} min`}
              onPress={() => setSnoozeSheet(true)}
            />
            <SwitchRow
              title="Vibration"
              subtitle="New alarms vibrate by default"
              checked={settings.defaultVibrate}
              onChange={(defaultVibrate) => void updateSettings({ defaultVibrate })}
            />
          </View>
        </Card>

        <Card padded={false}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>APPEARANCE</Text>

            <View style={styles.controlRow}>
              <Text style={[styles.controlLabel, { color: palette.textPrimary }]}>Clock format</Text>
              <SegmentedControl
                accessibilityLabel="Clock format"
                segments={[
                  { value: '12', label: '12-hour' },
                  { value: '24', label: '24-hour' },
                ]}
                value={settings.use24HourClock ? '24' : '12'}
                onChange={(value) => void updateSettings({ use24HourClock: value === '24' })}
              />
            </View>

            <View style={styles.controlRow}>
              <Text style={[styles.controlLabel, { color: palette.textPrimary }]}>Theme</Text>
              <SegmentedControl<ThemeMode>
                accessibilityLabel="Theme"
                segments={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
                value={settings.themeMode}
                onChange={(themeMode) => void updateSettings({ themeMode })}
              />
            </View>
          </View>
        </Card>

        <Card padded={false}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>RINGING</Text>
            <SettingRow
              title="Stop ringing after"
              subtitle="An unattended alarm is logged as missed"
              value={`${settings.autoDismissMinutes} min`}
              onPress={() => setAutoDismissSheet(true)}
            />
          </View>
        </Card>

        <Card padded={false}>
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>
              RELIABILITY {Platform.OS === 'android' ? '(ANDROID)' : ''}
            </Text>
            <SettingRow
              title="Notification permission"
              value={permission.granted ? 'Granted' : 'Denied'}
              onPress={() => {
                if (permission.granted) {
                  void openAppSettings();
                } else if (permission.canAskAgain) {
                  void requestPermission();
                } else {
                  void openAppSettings();
                }
              }}
            />
            {Platform.OS === 'android' ? (
              <>
                <SettingRow
                  title="Alarms & reminders"
                  subtitle="Required for alarms to fire at the exact minute"
                  onPress={() => void openExactAlarmSettings()}
                />
                <SettingRow
                  title="Battery optimisation"
                  subtitle="Exempt this app so Android does not delay alarms"
                  onPress={() => void openBatteryOptimizationSettings()}
                />
              </>
            ) : null}
            <SettingRow
              title="Alarm history"
              subtitle="Dismissed, snoozed and missed alarms"
              value={history.length > 0 ? String(history.length) : 'Empty'}
              onPress={() => navigation.navigate('History')}
            />
          </View>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <AppButton
            label="Reschedule all alarms"
            variant="secondary"
            fullWidth
            loading={resyncing}
            onPress={() => void handleResync()}
            accessibilityHint="Re-registers every enabled alarm with the system scheduler"
          />
          <AppButton
            label="Erase all data"
            variant="danger"
            fullWidth
            onPress={handleReset}
            accessibilityHint="Deletes every alarm, setting and history entry on this device"
          />
          <Text style={[styles.footnote, { color: palette.textMuted }]}>
            {alarms.filter((alarm) => alarm.enabled).length} of {alarms.length} alarms are armed.
            Alarms are stored on this device only.
          </Text>
        </View>
      </ScrollView>

      <OptionSheet
        visible={soundSheet}
        title="Default alarm sound"
        options={SOUND_OPTIONS}
        selected={settings.defaultSoundId}
        closeOnSelect={false}
        onHighlight={(soundId) => void previewSound(soundId)}
        onSelect={(defaultSoundId) => void updateSettings({ defaultSoundId })}
        onClose={() => {
          setSoundSheet(false);
          stopPreview();
        }}
      />

      <OptionSheet
        visible={snoozeSheet}
        title="Default snooze length"
        options={SNOOZE_SHEET_OPTIONS}
        selected={settings.defaultSnoozeMinutes}
        onSelect={(defaultSnoozeMinutes) => {
          void updateSettings({ defaultSnoozeMinutes });
          setSnoozeSheet(false);
        }}
        onClose={() => setSnoozeSheet(false)}
      />

      <OptionSheet
        visible={autoDismissSheet}
        title="Stop ringing after"
        options={AUTO_DISMISS_OPTIONS}
        selected={settings.autoDismissMinutes}
        onSelect={(autoDismissMinutes) => {
          void updateSettings({ autoDismissMinutes });
          setAutoDismissSheet(false);
        }}
        onClose={() => setAutoDismissSheet(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 6 },
  controlRow: { paddingVertical: 10, gap: 10 },
  controlLabel: { fontSize: 16, fontWeight: '500' },
  footnote: { fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
