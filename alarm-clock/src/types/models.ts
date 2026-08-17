/**
 * The persisted domain model. Everything the app stores on the device is
 * described here; the storage layer versions and migrates these shapes.
 */

/** `0` is Sunday … `6` is Saturday, matching `Date.prototype.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];

/** Identifier of a bundled tone, or `silent` for a vibrate-only alarm. */
export type SoundId = 'classic_bell' | 'digital_beep' | 'radar' | 'chimes' | 'sunrise' | 'silent';

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Alarm {
  id: string;
  /** Local wall-clock hour, `0`–`23`. */
  hour: number;
  /** Local wall-clock minute, `0`–`59`. */
  minute: number;
  label: string;
  /**
   * Days the alarm repeats on. An empty array means the alarm fires exactly
   * once (at its next occurrence) and then disables itself.
   */
  repeatDays: Weekday[];
  soundId: SoundId;
  vibrate: boolean;
  /** Minutes to postpone by when snoozed. `0` disables snoozing entirely. */
  snoozeMinutes: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

/** The editable subset of an alarm, used by the create/edit screen. */
export type AlarmDraft = Omit<Alarm, 'id' | 'createdAt' | 'updatedAt'>;

export interface Settings {
  defaultSoundId: SoundId;
  defaultSnoozeMinutes: number;
  defaultVibrate: boolean;
  /** `true` renders 18:30, `false` renders 6:30 PM. */
  use24HourClock: boolean;
  themeMode: ThemeMode;
  /**
   * How long the ringing screen keeps ringing before it gives up and records
   * the alarm as missed. Mirrors the OS behaviour of not ringing forever.
   */
  autoDismissMinutes: number;
}

export type HistoryAction = 'dismissed' | 'snoozed' | 'missed';

export interface HistoryEntry {
  id: string;
  alarmId: string;
  /** Copied from the alarm so history survives the alarm being deleted. */
  label: string;
  /** The occurrence the entry belongs to (epoch ms). */
  scheduledFor: number;
  /** When the user (or the app) acted on it (epoch ms). */
  recordedAt: number;
  action: HistoryAction;
}

/**
 * One scheduled OS notification. Persisting these lets the app reconcile what
 * it *wants* scheduled against what is *actually* scheduled, which is how
 * duplicates are prevented and missed alarms are detected after a cold start.
 */
export interface ScheduledOccurrence {
  /** Notification identifier handed to `expo-notifications`. */
  notificationId: string;
  alarmId: string;
  /** Epoch ms the notification is expected to fire at. */
  firesAt: number;
  kind: 'alarm' | 'snooze';
}

export const DEFAULT_SETTINGS: Settings = {
  defaultSoundId: 'classic_bell',
  defaultSnoozeMinutes: 9,
  defaultVibrate: true,
  use24HourClock: false,
  themeMode: 'system',
  autoDismissMinutes: 5,
};

export const SNOOZE_OPTIONS = [0, 5, 9, 10, 15, 20, 30] as const;

/** Upper bound on how many rows the history log keeps. */
export const HISTORY_LIMIT = 200;
