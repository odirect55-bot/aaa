import type { AlarmDraft } from '../../types/models';
import { DEFAULT_SETTINGS } from '../../types/models';
import {
  normaliseDraft,
  parseStoredAlarm,
  parseStoredSettings,
  validateDraft,
} from '../validation';

function makeDraft(overrides: Partial<AlarmDraft> = {}): AlarmDraft {
  return {
    hour: 7,
    minute: 30,
    label: 'Wake up',
    repeatDays: [1, 2],
    soundId: 'classic_bell',
    vibrate: true,
    snoozeMinutes: 9,
    enabled: true,
    ...overrides,
  };
}

describe('validateDraft', () => {
  it('accepts a well-formed alarm', () => {
    expect(validateDraft(makeDraft())).toEqual({ valid: true, errors: [] });
  });

  it.each([
    ['hour out of range', { hour: 24 }],
    ['fractional hour', { hour: 7.5 }],
    ['minute out of range', { minute: 60 }],
    ['unknown sound', { soundId: 'foghorn' as AlarmDraft['soundId'] }],
    ['negative snooze', { snoozeMinutes: -5 }],
    ['excessive snooze', { snoozeMinutes: 120 }],
    ['duplicate repeat days', { repeatDays: [1, 1] as AlarmDraft['repeatDays'] }],
    ['invalid weekday', { repeatDays: [9] as unknown as AlarmDraft['repeatDays'] }],
  ])('rejects %s', (_name, patch) => {
    expect(validateDraft(makeDraft(patch)).valid).toBe(false);
  });

  it('rejects an alarm that can neither sound nor vibrate', () => {
    const result = validateDraft(makeDraft({ soundId: 'silent', vibrate: false }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/vibration/i);
  });

  it('allows a silent alarm that vibrates', () => {
    expect(validateDraft(makeDraft({ soundId: 'silent', vibrate: true })).valid).toBe(true);
  });

  it('rejects an over-long label', () => {
    expect(validateDraft(makeDraft({ label: 'x'.repeat(41) })).valid).toBe(false);
  });
});

describe('normaliseDraft', () => {
  it('trims the label, clamps numbers and de-duplicates days', () => {
    const result = normaliseDraft(
      makeDraft({
        label: '  Gym  ',
        hour: 30,
        minute: -4,
        snoozeMinutes: 999,
        repeatDays: [3, 1, 3] as AlarmDraft['repeatDays'],
      })
    );

    expect(result.label).toBe('Gym');
    expect(result.hour).toBe(23);
    expect(result.minute).toBe(0);
    expect(result.snoozeMinutes).toBe(60);
    expect(result.repeatDays).toEqual([1, 3]);
  });

  it('produces a draft that always validates', () => {
    const normalised = normaliseDraft(makeDraft({ hour: 99, label: 'y'.repeat(80) }));
    expect(validateDraft(normalised).valid).toBe(true);
  });
});

describe('parseStoredAlarm', () => {
  it('reads back a well-formed record', () => {
    const alarm = parseStoredAlarm({
      id: 'alarm_1',
      hour: 6,
      minute: 15,
      label: 'Run',
      repeatDays: [1, 3, 5],
      soundId: 'radar',
      vibrate: false,
      snoozeMinutes: 5,
      enabled: true,
      createdAt: 1,
      updatedAt: 2,
    });

    expect(alarm).toMatchObject({ id: 'alarm_1', hour: 6, soundId: 'radar', enabled: true });
  });

  it('repairs partially damaged records instead of dropping them', () => {
    const alarm = parseStoredAlarm({
      id: 'alarm_2',
      hour: 99,
      minute: 15,
      repeatDays: ['monday', 2],
      soundId: 'no-such-sound',
    });

    expect(alarm).not.toBeNull();
    expect(alarm?.hour).toBe(23);
    expect(alarm?.repeatDays).toEqual([2]);
    expect(alarm?.soundId).toBe(DEFAULT_SETTINGS.defaultSoundId);
    expect(alarm?.label).toBe('');
    expect(alarm?.enabled).toBe(false);
  });

  it.each([[null], [undefined], ['string'], [{}], [{ id: 'x' }], [{ hour: 1, minute: 1 }]])(
    'drops unusable record %#',
    (value) => {
      expect(parseStoredAlarm(value)).toBeNull();
    }
  );
});

describe('parseStoredSettings', () => {
  it('falls back to defaults for missing or invalid fields', () => {
    expect(parseStoredSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseStoredSettings({ themeMode: 'neon', defaultSnoozeMinutes: 'ten' })).toEqual(
      DEFAULT_SETTINGS
    );
  });

  it('keeps valid stored values', () => {
    const settings = parseStoredSettings({
      defaultSoundId: 'chimes',
      defaultSnoozeMinutes: 15,
      defaultVibrate: false,
      use24HourClock: true,
      themeMode: 'dark',
      autoDismissMinutes: 10,
    });

    expect(settings).toEqual({
      defaultSoundId: 'chimes',
      defaultSnoozeMinutes: 15,
      defaultVibrate: false,
      use24HourClock: true,
      themeMode: 'dark',
      autoDismissMinutes: 10,
    });
  });
});
