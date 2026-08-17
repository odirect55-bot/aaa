import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  Alarm,
  HistoryEntry,
  ScheduledOccurrence,
  Settings,
} from '../types/models';
import { DEFAULT_SETTINGS, HISTORY_LIMIT } from '../types/models';
import { logger } from '../utils/logger';
import { parseStoredAlarm, parseStoredSettings } from '../utils/validation';

/**
 * Persistence layer. Every read is defensive: a corrupted or partially written
 * value degrades to a sane default rather than crashing the app on launch.
 *
 * The storage version lets future releases migrate old records; `migrate()` is
 * the single place that knows about historical shapes.
 */

const STORAGE_VERSION = 1;

const KEYS = {
  version: 'alarmclock:version',
  alarms: 'alarmclock:alarms',
  settings: 'alarmclock:settings',
  history: 'alarmclock:history',
  schedule: 'alarmclock:schedule',
  timeContext: 'alarmclock:timeContext',
} as const;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) {
      return null;
    }
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.error('storage', `Failed reading ${key}: ${String(error)}`);
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    logger.error('storage', `Failed writing ${key}: ${String(error)}`);
    throw error;
  }
}

async function migrate(): Promise<void> {
  const storedVersion = await readJson<number>(KEYS.version);
  if (storedVersion === STORAGE_VERSION) {
    return;
  }
  // No historical shapes exist yet; future migrations branch on storedVersion.
  await writeJson(KEYS.version, STORAGE_VERSION);
  if (storedVersion !== null) {
    logger.info('storage', `Migrated storage from v${storedVersion} to v${STORAGE_VERSION}`);
  }
}

export const storage = {
  async loadAlarms(): Promise<Alarm[]> {
    await migrate();
    const raw = await readJson<unknown[]>(KEYS.alarms);
    if (!Array.isArray(raw)) {
      return [];
    }

    const alarms: Alarm[] = [];
    let dropped = 0;
    for (const item of raw) {
      const parsed = parseStoredAlarm(item);
      if (parsed) {
        alarms.push(parsed);
      } else {
        dropped += 1;
      }
    }
    if (dropped > 0) {
      logger.warn('storage', `Dropped ${dropped} unreadable alarm record(s)`);
    }
    return alarms;
  },

  async saveAlarms(alarms: Alarm[]): Promise<void> {
    await writeJson(KEYS.alarms, alarms);
  },

  async loadSettings(): Promise<Settings> {
    await migrate();
    const raw = await readJson<unknown>(KEYS.settings);
    return raw === null ? { ...DEFAULT_SETTINGS } : parseStoredSettings(raw);
  },

  async saveSettings(settings: Settings): Promise<void> {
    await writeJson(KEYS.settings, settings);
  },

  async loadHistory(): Promise<HistoryEntry[]> {
    const raw = await readJson<HistoryEntry[]>(KEYS.history);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw
      .filter(
        (entry): entry is HistoryEntry =>
          typeof entry?.id === 'string' &&
          typeof entry?.alarmId === 'string' &&
          typeof entry?.scheduledFor === 'number'
      )
      .slice(0, HISTORY_LIMIT);
  },

  async saveHistory(history: HistoryEntry[]): Promise<void> {
    await writeJson(KEYS.history, history.slice(0, HISTORY_LIMIT));
  },

  async loadSchedule(): Promise<ScheduledOccurrence[]> {
    const raw = await readJson<ScheduledOccurrence[]>(KEYS.schedule);
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter(
      (entry): entry is ScheduledOccurrence =>
        typeof entry?.notificationId === 'string' &&
        typeof entry?.alarmId === 'string' &&
        typeof entry?.firesAt === 'number'
    );
  },

  async saveSchedule(schedule: ScheduledOccurrence[]): Promise<void> {
    await writeJson(KEYS.schedule, schedule);
  },

  async loadTimeContext(): Promise<string | null> {
    return readJson<string>(KEYS.timeContext);
  },

  async saveTimeContext(context: string): Promise<void> {
    await writeJson(KEYS.timeContext, context);
  },

  /** Used by the "reset app data" action in Settings. */
  async clearAll(): Promise<void> {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  },
};
