import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { DayPicker } from '../components/DayPicker';
import { NoticeBanner } from '../components/NoticeBanner';
import { OptionSheet, type SheetOption } from '../components/OptionSheet';
import { Screen } from '../components/Screen';
import { SettingRow, SwitchRow } from '../components/SettingRow';
import { TimePicker } from '../components/TimePicker';
import { ALARM_SOUNDS, getSoundName } from '../constants/sounds';
import type { RootScreenProps } from '../navigation/types';
import { previewSound, stopRinging } from '../services/alarmAudio';
import { useAlarmStore } from '../state/AlarmStore';
import { useTheme } from '../theme/ThemeProvider';
import type { AlarmDraft, SoundId, Weekday } from '../types/models';
import { SNOOZE_OPTIONS } from '../types/models';
import { describeError } from '../utils/logger';
import {
  formatCountdown,
  formatMeridiem,
  formatRelativeDay,
  formatTime,
  nextOccurrences,
} from '../utils/time';
import { MAX_LABEL_LENGTH, validateDraft } from '../utils/validation';

const SNOOZE_SHEET_OPTIONS: SheetOption<number>[] = SNOOZE_OPTIONS.map((minutes) => ({
  value: minutes,
  label: minutes === 0 ? 'Off' : `${minutes} minutes`,
  description: minutes === 0 ? 'The alarm cannot be snoozed' : undefined,
}));

const SOUND_SHEET_OPTIONS: SheetOption<SoundId>[] = ALARM_SOUNDS.map((sound) => ({
  value: sound.id,
  label: sound.name,
  description: sound.description,
}));

export function AlarmEditScreen({ navigation, route }: RootScreenProps<'AlarmEdit'>) {
  const { palette, spacing } = useTheme();
  const { alarms, settings, addAlarm, updateAlarm, deleteAlarm } = useAlarmStore();

  const alarmId = route.params?.alarmId;
  const existing = useMemo(
    () => alarms.find((alarm) => alarm.id === alarmId) ?? null,
    [alarmId, alarms]
  );
  const isEditing = existing !== null;

  const [draft, setDraft] = useState<AlarmDraft>(() => {
    if (existing) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = existing;
      return rest;
    }
    const now = new Date();
    // Default to the next round hour, which is the most common intent.
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    return {
      hour: start.getHours(),
      minute: 0,
      label: '',
      repeatDays: [],
      soundId: settings.defaultSoundId,
      vibrate: settings.defaultVibrate,
      snoozeMinutes: settings.defaultSnoozeMinutes,
      enabled: true,
    };
  });

  const [soundSheetVisible, setSoundSheetVisible] = useState(false);
  const [snoozeSheetVisible, setSnoozeSheetVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Never leave a preview tone playing behind you.
  useEffect(() => () => void stopRinging(), []);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit alarm' : 'New alarm' });
  }, [isEditing, navigation]);

  const validation = useMemo(() => validateDraft(draft), [draft]);

  const preview = useMemo(() => {
    const upcoming = nextOccurrences(draft, new Date(), 1)[0];
    if (!upcoming) {
      return null;
    }
    return `Rings ${formatRelativeDay(upcoming).toLowerCase()} · ${formatCountdown(upcoming)}`;
  }, [draft]);

  const handleSave = useCallback(async () => {
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEditing && alarmId) {
        await updateAlarm(alarmId, draft);
      } else {
        await addAlarm(draft);
      }
      navigation.goBack();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSaving(false);
    }
  }, [addAlarm, alarmId, draft, isEditing, navigation, updateAlarm, validation]);

  const handleDelete = useCallback(() => {
    if (!alarmId) {
      return;
    }
    Alert.alert('Delete alarm?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteAlarm(alarmId).then(() => navigation.goBack());
        },
      },
    ]);
  }, [alarmId, deleteAlarm, navigation]);

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Card>
            <TimePicker
              hour={draft.hour}
              minute={draft.minute}
              use24HourClock={settings.use24HourClock}
              onChange={({ hour, minute }) => setDraft((current) => ({ ...current, hour, minute }))}
            />
            <Text style={[styles.previewText, { color: palette.textSecondary }]}>
              {formatTime(draft.hour, draft.minute, settings.use24HourClock)}
              {settings.use24HourClock ? '' : ` ${formatMeridiem(draft.hour)}`}
              {preview ? ` · ${preview.replace('Rings ', '')}` : ''}
            </Text>
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>REPEAT</Text>
            <DayPicker
              value={draft.repeatDays}
              onChange={(repeatDays: Weekday[]) =>
                setDraft((current) => ({ ...current, repeatDays }))
              }
            />
          </Card>

          <Card>
            <Text style={[styles.sectionTitle, { color: palette.textMuted }]}>LABEL</Text>
            <TextInput
              accessibilityLabel="Alarm label"
              value={draft.label}
              onChangeText={(label) => setDraft((current) => ({ ...current, label }))}
              placeholder="Wake up"
              placeholderTextColor={palette.textMuted}
              maxLength={MAX_LABEL_LENGTH}
              returnKeyType="done"
              style={[
                styles.input,
                {
                  color: palette.textPrimary,
                  backgroundColor: palette.surfaceSubtle,
                  borderColor: palette.border,
                },
              ]}
            />
          </Card>

          <Card padded={false}>
            <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
              <SettingRow
                title="Sound"
                value={getSoundName(draft.soundId)}
                onPress={() => setSoundSheetVisible(true)}
              />
              <SwitchRow
                title="Vibration"
                subtitle="Vibrates the phone while the alarm rings"
                checked={draft.vibrate}
                onChange={(vibrate) => setDraft((current) => ({ ...current, vibrate }))}
              />
              <SettingRow
                title="Snooze"
                value={draft.snoozeMinutes === 0 ? 'Off' : `${draft.snoozeMinutes} min`}
                onPress={() => setSnoozeSheetVisible(true)}
              />
              <SwitchRow
                title="Enabled"
                subtitle={draft.enabled ? 'This alarm is armed' : 'Saved but will not ring'}
                checked={draft.enabled}
                onChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
              />
            </View>
          </Card>

          {error ? <NoticeBanner tone="danger" title="Cannot save" message={error} /> : null}
          {!error && !validation.valid ? (
            <NoticeBanner tone="warning" title="Check the alarm" message={validation.errors[0]} />
          ) : null}

          <View style={{ gap: spacing.md }}>
            <AppButton
              label={isEditing ? 'Save changes' : 'Create alarm'}
              onPress={() => void handleSave()}
              size="large"
              fullWidth
              loading={saving}
              disabled={!validation.valid}
            />
            <AppButton
              label="Cancel"
              variant="secondary"
              onPress={() => navigation.goBack()}
              size="large"
              fullWidth
            />
            {isEditing ? (
              <AppButton label="Delete alarm" variant="danger" onPress={handleDelete} fullWidth />
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={soundSheetVisible}
        title="Alarm sound"
        options={SOUND_SHEET_OPTIONS}
        selected={draft.soundId}
        onHighlight={(soundId) => void previewSound(soundId)}
        onSelect={(soundId) => {
          setDraft((current) => ({ ...current, soundId }));
          setSoundSheetVisible(false);
          void stopRinging();
        }}
        onClose={() => {
          setSoundSheetVisible(false);
          void stopRinging();
        }}
      />

      <OptionSheet
        visible={snoozeSheetVisible}
        title="Snooze length"
        options={SNOOZE_SHEET_OPTIONS}
        selected={draft.snoozeMinutes}
        onSelect={(snoozeMinutes) => {
          setDraft((current) => ({ ...current, snoozeMinutes }));
          setSnoozeSheetVisible(false);
        }}
        onClose={() => setSnoozeSheetVisible(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 12 },
  previewText: { fontSize: 14, textAlign: 'center', marginTop: 16, fontWeight: '500' },
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    fontSize: 16,
  },
});
