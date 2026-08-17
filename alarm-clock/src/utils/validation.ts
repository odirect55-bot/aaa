import { isKnownSoundId } from '../constants/sounds';
import type { Alarm, AlarmDraft, Settings, Weekday } from '../types/models';
import { DEFAULT_SETTINGS } from '../types/models';

export const MAX_LABEL_LENGTH = 40;
export const MAX_SNOOZE_MINUTES = 60;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function isWeekday(value: unknown): value is Weekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
}

/** Validates user input before it is allowed to become a stored alarm. */
export function validateDraft(draft: AlarmDraft): ValidationResult {
  const errors: string[] = [];

  if (!Number.isInteger(draft.hour) || draft.hour < 0 || draft.hour > 23) {
    errors.push('Hour must be between 0 and 23.');
  }
  if (!Number.isInteger(draft.minute) || draft.minute < 0 || draft.minute > 59) {
    errors.push('Minute must be between 0 and 59.');
  }
  if (draft.label.length > MAX_LABEL_LENGTH) {
    errors.push(`Label must be ${MAX_LABEL_LENGTH} characters or fewer.`);
  }
  if (!Array.isArray(draft.repeatDays) || !draft.repeatDays.every(isWeekday)) {
    errors.push('Repeat days are invalid.');
  } else if (new Set(draft.repeatDays).size !== draft.repeatDays.length) {
    errors.push('Repeat days contain duplicates.');
  }
  if (!isKnownSoundId(draft.soundId)) {
    errors.push('Choose an alarm sound.');
  }
  if (
    !Number.isInteger(draft.snoozeMinutes) ||
    draft.snoozeMinutes < 0 ||
    draft.snoozeMinutes > MAX_SNOOZE_MINUTES
  ) {
    errors.push(`Snooze must be between 0 and ${MAX_SNOOZE_MINUTES} minutes.`);
  }
  if (draft.soundId === 'silent' && !draft.vibrate) {
    errors.push('A silent alarm needs vibration turned on, otherwise it cannot wake you.');
  }

  return { valid: errors.length === 0, errors };
}

/** Trims and clamps a draft so it is safe to persist. */
export function normaliseDraft(draft: AlarmDraft): AlarmDraft {
  const uniqueDays = Array.from(new Set(draft.repeatDays.filter(isWeekday))).sort(
    (a, b) => a - b
  ) as Weekday[];

  return {
    ...draft,
    hour: clampInteger(draft.hour, 0, 23),
    minute: clampInteger(draft.minute, 0, 59),
    label: draft.label.trim().slice(0, MAX_LABEL_LENGTH),
    repeatDays: uniqueDays,
    snoozeMinutes: clampInteger(draft.snoozeMinutes, 0, MAX_SNOOZE_MINUTES),
  };
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Coerces an unknown value read back from storage into a valid `Alarm`, or
 * returns `null` when the record is too damaged to repair. Storage is the one
 * place where malformed data can enter the app, so it is checked field by
 * field rather than trusted.
 */
export function parseStoredAlarm(value: unknown): Alarm | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;

  if (typeof record.id !== 'string' || record.id.length === 0) {
    return null;
  }
  if (typeof record.hour !== 'number' || typeof record.minute !== 'number') {
    return null;
  }

  const repeatDays = Array.isArray(record.repeatDays)
    ? (Array.from(new Set(record.repeatDays.filter(isWeekday))).sort((a, b) => a - b) as Weekday[])
    : [];

  const soundId =
    typeof record.soundId === 'string' && isKnownSoundId(record.soundId)
      ? record.soundId
      : DEFAULT_SETTINGS.defaultSoundId;

  const now = Date.now();

  return {
    id: record.id,
    hour: clampInteger(record.hour, 0, 23),
    minute: clampInteger(record.minute, 0, 59),
    label: typeof record.label === 'string' ? record.label.slice(0, MAX_LABEL_LENGTH) : '',
    repeatDays,
    soundId,
    vibrate: typeof record.vibrate === 'boolean' ? record.vibrate : true,
    snoozeMinutes:
      typeof record.snoozeMinutes === 'number'
        ? clampInteger(record.snoozeMinutes, 0, MAX_SNOOZE_MINUTES)
        : DEFAULT_SETTINGS.defaultSnoozeMinutes,
    enabled: typeof record.enabled === 'boolean' ? record.enabled : false,
    createdAt: typeof record.createdAt === 'number' ? record.createdAt : now,
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : now,
  };
}

/** Same idea as {@link parseStoredAlarm}, for the settings blob. */
export function parseStoredSettings(value: unknown): Settings {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_SETTINGS };
  }
  const record = value as Record<string, unknown>;

  return {
    defaultSoundId:
      typeof record.defaultSoundId === 'string' && isKnownSoundId(record.defaultSoundId)
        ? record.defaultSoundId
        : DEFAULT_SETTINGS.defaultSoundId,
    defaultSnoozeMinutes:
      typeof record.defaultSnoozeMinutes === 'number'
        ? clampInteger(record.defaultSnoozeMinutes, 0, MAX_SNOOZE_MINUTES)
        : DEFAULT_SETTINGS.defaultSnoozeMinutes,
    defaultVibrate:
      typeof record.defaultVibrate === 'boolean'
        ? record.defaultVibrate
        : DEFAULT_SETTINGS.defaultVibrate,
    use24HourClock:
      typeof record.use24HourClock === 'boolean'
        ? record.use24HourClock
        : DEFAULT_SETTINGS.use24HourClock,
    themeMode:
      record.themeMode === 'light' || record.themeMode === 'dark' || record.themeMode === 'system'
        ? record.themeMode
        : DEFAULT_SETTINGS.themeMode,
    autoDismissMinutes:
      typeof record.autoDismissMinutes === 'number'
        ? clampInteger(record.autoDismissMinutes, 1, 30)
        : DEFAULT_SETTINGS.autoDismissMinutes,
  };
}
