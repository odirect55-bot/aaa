import * as Notifications from 'expo-notifications';

import { getSound } from '../../constants/sounds';
import type { Alarm, HistoryEntry, ScheduledOccurrence, Settings } from '../../types/models';
import { createId } from '../../utils/id';
import { logger } from '../../utils/logger';
import {
  DAY_LABELS_MEDIUM,
  formatRepeatDays,
  formatTime,
  nextOccurrences,
} from '../../utils/time';
import {
  channelIdFor,
  ensureAlarmChannel,
  pruneUnusedChannels,
  refreshChannelCache,
} from './channels';

/**
 * Turns alarms into real OS notifications.
 *
 * Design notes
 * ------------
 * * Every notification gets a **deterministic identifier** derived from the
 *   alarm id and the exact instant it fires. Rescheduling the same occurrence
 *   therefore replaces it instead of adding a duplicate, and the app can diff
 *   "what should be scheduled" against "what the OS actually has scheduled".
 * * Repeating alarms are expanded into a rolling window of concrete
 *   `DATE` triggers rather than a single recurring trigger. Concrete dates are
 *   computed in local wall-clock time, so DST shifts and time-zone changes are
 *   handled by rebuilding the window (see `syncSchedule`) instead of by hoping
 *   a recurring trigger does the right thing.
 * * The window is deep enough that an app which is never opened again still
 *   rings for weeks; every foreground pass tops it back up.
 */

export const ALARM_PREFIX = 'alarm.';
export const SNOOZE_PREFIX = 'snooze.';

/** How many future occurrences of a repeating alarm are kept scheduled. */
export const OCCURRENCES_AHEAD = 8;

/** Past occurrences younger than this are still "in flight", not missed. */
export const MISSED_GRACE_MS = 2 * 60_000;

export interface PlannedNotification {
  identifier: string;
  alarmId: string;
  firesAt: number;
}

export interface SyncResult {
  scheduled: number;
  cancelled: number;
  failed: number;
  occurrences: ScheduledOccurrence[];
}

export interface ReconcileResult {
  /** One-shot alarms whose only occurrence has passed. */
  alarmIdsToDisable: string[];
  /** History rows for occurrences that were never acted on. */
  missedEntries: HistoryEntry[];
  /** Occurrences that are still in the future. */
  remaining: ScheduledOccurrence[];
}

export function alarmNotificationId(alarmId: string, firesAt: number): string {
  return `${ALARM_PREFIX}${alarmId}.${firesAt}`;
}

export function snoozeNotificationId(alarmId: string, firesAt: number): string {
  return `${SNOOZE_PREFIX}${alarmId}.${firesAt}`;
}

export function isOwnedIdentifier(identifier: string): boolean {
  return identifier.startsWith(ALARM_PREFIX) || identifier.startsWith(SNOOZE_PREFIX);
}

export function alarmIdFromIdentifier(identifier: string): string | null {
  const withoutPrefix = identifier.startsWith(ALARM_PREFIX)
    ? identifier.slice(ALARM_PREFIX.length)
    : identifier.startsWith(SNOOZE_PREFIX)
      ? identifier.slice(SNOOZE_PREFIX.length)
      : null;
  if (withoutPrefix === null) {
    return null;
  }
  const separator = withoutPrefix.lastIndexOf('.');
  return separator === -1 ? withoutPrefix : withoutPrefix.slice(0, separator);
}

/** Pure: the notifications a single alarm should currently have scheduled. */
export function planForAlarm(
  alarm: Alarm,
  now: Date,
  occurrencesAhead: number = OCCURRENCES_AHEAD
): PlannedNotification[] {
  if (!alarm.enabled) {
    return [];
  }
  const count = alarm.repeatDays.length === 0 ? 1 : occurrencesAhead;
  return nextOccurrences(alarm, now, count).map((date) => ({
    identifier: alarmNotificationId(alarm.id, date.getTime()),
    alarmId: alarm.id,
    firesAt: date.getTime(),
  }));
}

/** Pure: the full desired schedule across every alarm. */
export function planAll(
  alarms: Alarm[],
  now: Date,
  occurrencesAhead: number = OCCURRENCES_AHEAD
): PlannedNotification[] {
  return alarms.flatMap((alarm) => planForAlarm(alarm, now, occurrencesAhead));
}

/**
 * Pure: what to add and what to remove, given what the OS currently holds.
 *
 * Snoozes are ad-hoc and never part of a plan, so they survive a sync unless
 * their alarm no longer exists or has been switched off.
 */
export function diffSchedule(
  planned: PlannedNotification[],
  existingIdentifiers: string[],
  liveAlarmIds: Set<string>
): { toSchedule: PlannedNotification[]; toCancel: string[] } {
  const plannedIds = new Set(planned.map((item) => item.identifier));
  const existing = new Set(existingIdentifiers.filter(isOwnedIdentifier));

  const toSchedule = planned.filter((item) => !existing.has(item.identifier));

  const toCancel = [...existing].filter((identifier) => {
    if (plannedIds.has(identifier)) {
      return false;
    }
    if (identifier.startsWith(SNOOZE_PREFIX)) {
      const alarmId = alarmIdFromIdentifier(identifier);
      return alarmId === null || !liveAlarmIds.has(alarmId);
    }
    return true;
  });

  return { toSchedule, toCancel };
}

/**
 * Pure: works out what happened while the app was not running.
 *
 * Anything the app had scheduled that is now comfortably in the past and has
 * no history row was never dismissed or snoozed, so it is recorded as missed;
 * a one-shot alarm whose occurrence has passed switches itself off, which is
 * what users expect from a "ring once" alarm.
 */
export function reconcilePastOccurrences(
  alarms: Alarm[],
  schedule: ScheduledOccurrence[],
  history: HistoryEntry[],
  now: Date = new Date()
): ReconcileResult {
  const cutoff = now.getTime() - MISSED_GRACE_MS;
  const alarmsById = new Map(alarms.map((alarm) => [alarm.id, alarm]));
  const handled = new Set(history.map((entry) => `${entry.alarmId}@${entry.scheduledFor}`));

  const alarmIdsToDisable: string[] = [];
  const missedEntries: HistoryEntry[] = [];
  const remaining: ScheduledOccurrence[] = [];

  for (const occurrence of schedule) {
    if (occurrence.firesAt > now.getTime()) {
      remaining.push(occurrence);
      continue;
    }
    if (occurrence.firesAt > cutoff) {
      // Fired moments ago: the ringing screen may still be dealing with it.
      remaining.push(occurrence);
      continue;
    }

    const alarm = alarmsById.get(occurrence.alarmId);
    if (!alarm) {
      continue;
    }

    const key = `${occurrence.alarmId}@${occurrence.firesAt}`;
    if (!handled.has(key)) {
      handled.add(key);
      missedEntries.push({
        id: createId('history'),
        alarmId: alarm.id,
        label: alarm.label,
        scheduledFor: occurrence.firesAt,
        recordedAt: now.getTime(),
        action: 'missed',
      });
    }

    if (
      occurrence.kind === 'alarm' &&
      alarm.repeatDays.length === 0 &&
      alarm.enabled &&
      !alarmIdsToDisable.includes(alarm.id)
    ) {
      alarmIdsToDisable.push(alarm.id);
    }
  }

  return { alarmIdsToDisable, missedEntries, remaining };
}

interface AlarmNotificationOptions {
  alarm: Alarm;
  settings: Settings;
  firesAt: number;
  kind: 'alarm' | 'snooze';
}

function buildContent({
  alarm,
  settings,
  firesAt,
  kind,
}: AlarmNotificationOptions): Notifications.NotificationContentInput {
  const sound = getSound(alarm.soundId);
  const time = formatTime(alarm.hour, alarm.minute, settings.use24HourClock);
  const meridiem = settings.use24HourClock ? '' : alarm.hour < 12 ? ' AM' : ' PM';
  const occurrence = new Date(firesAt);

  const title = alarm.label.trim().length > 0 ? alarm.label.trim() : 'Alarm';
  const body =
    kind === 'snooze'
      ? `Snoozed alarm · ${formatTime(occurrence.getHours(), occurrence.getMinutes(), settings.use24HourClock)}${
          settings.use24HourClock ? '' : occurrence.getHours() < 12 ? ' AM' : ' PM'
        }`
      : `${time}${meridiem} · ${
          alarm.repeatDays.length === 0
            ? DAY_LABELS_MEDIUM[occurrence.getDay()]
            : formatRepeatDays(alarm.repeatDays)
        }`;

  return {
    title,
    body,
    categoryIdentifier: ALARM_CATEGORY_ID,
    priority: Notifications.AndroidNotificationPriority.MAX,
    color: '#6C5CE7',
    // Android 8+ takes the sound from the channel; this covers older devices
    // and iOS. Deliberately never `false`: that flags the whole notification
    // as silent and would kill vibration for the "Silent" tone too.
    ...(sound.fileName ? { sound: sound.fileName } : {}),
    vibrate: alarm.vibrate ? [0, 700, 400, 700, 400, 700] : undefined,
    // An alarm should not disappear on its own or be flicked away by accident.
    sticky: true,
    autoDismiss: false,
    interruptionLevel: 'timeSensitive',
    data: {
      type: 'alarm',
      alarmId: alarm.id,
      firesAt,
      kind,
    },
  };
}

export const ALARM_CATEGORY_ID = 'alarm-ringing';

/**
 * Registers the Snooze / Dismiss buttons shown on the notification.
 *
 * Both actions foreground the app on purpose: acting on an alarm has to run
 * JavaScript (schedule the snooze, write history, stop the sound), and Android
 * does not deliver responses to a killed app for background actions.
 */
export async function ensureNotificationCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(ALARM_CATEGORY_ID, [
      {
        identifier: 'snooze',
        buttonTitle: 'Snooze',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Dismiss',
        options: { opensAppToForeground: true, isDestructive: true },
      },
    ]);
  } catch (error) {
    logger.error('scheduler', error);
  }
}

async function scheduleOne(
  options: AlarmNotificationOptions,
  identifier: string
): Promise<ScheduledOccurrence | null> {
  const { alarm, firesAt, kind } = options;
  try {
    const channelId = await ensureAlarmChannel(alarm.soundId, alarm.vibrate);
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: buildContent(options),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: firesAt,
        ...(channelId ? { channelId } : {}),
      },
    });
    return { notificationId: identifier, alarmId: alarm.id, firesAt, kind };
  } catch (error) {
    logger.error('scheduler', `Could not schedule ${identifier}: ${String(error)}`);
    return null;
  }
}

async function cancelMany(identifiers: string[]): Promise<number> {
  let cancelled = 0;
  for (const identifier of identifiers) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      cancelled += 1;
    } catch (error) {
      // A notification that already fired is no longer cancellable; that is
      // not an error worth surfacing.
      logger.warn('scheduler', `Could not cancel ${identifier}: ${String(error)}`);
    }
  }
  return cancelled;
}

/**
 * Brings the OS schedule in line with the alarm list.
 *
 * Reads back what is actually scheduled instead of trusting local bookkeeping,
 * which keeps things correct after a reboot, a crash, an OS cleanup, or a
 * time-zone change.
 */
export async function syncSchedule(
  alarms: Alarm[],
  settings: Settings,
  existingSnoozes: ScheduledOccurrence[] = []
): Promise<SyncResult> {
  const now = new Date();
  const planned = planAll(alarms, now);

  // Re-read the channels first: they may have been deleted from the system
  // settings since the last pass, and each alarm needs its own back.
  await refreshChannelCache();
  const liveAlarmIds = new Set(alarms.filter((alarm) => alarm.enabled).map((alarm) => alarm.id));

  let existingIdentifiers: string[] = [];
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    existingIdentifiers = existing.map((request) => request.identifier);
  } catch (error) {
    logger.error('scheduler', error);
  }

  const { toSchedule, toCancel } = diffSchedule(planned, existingIdentifiers, liveAlarmIds);

  const cancelled = await cancelMany(toCancel);

  const alarmsById = new Map(alarms.map((alarm) => [alarm.id, alarm]));
  const occurrences: ScheduledOccurrence[] = [];
  let failed = 0;

  // Occurrences that were already scheduled stay scheduled; re-listing them
  // keeps the persisted record complete.
  const cancelledSet = new Set(toCancel);
  const scheduledSet = new Set(toSchedule.map((item) => item.identifier));
  for (const item of planned) {
    if (!scheduledSet.has(item.identifier) && !cancelledSet.has(item.identifier)) {
      occurrences.push({
        notificationId: item.identifier,
        alarmId: item.alarmId,
        firesAt: item.firesAt,
        kind: 'alarm',
      });
    }
  }

  for (const item of toSchedule) {
    const alarm = alarmsById.get(item.alarmId);
    if (!alarm) {
      continue;
    }
    const result = await scheduleOne(
      { alarm, settings, firesAt: item.firesAt, kind: 'alarm' },
      item.identifier
    );
    if (result) {
      occurrences.push(result);
    } else {
      failed += 1;
    }
  }

  // Keep snooze records whose notification is still pending. Anything that is
  // not a snooze is rebuilt from the plan above, so it is ignored here even if
  // the caller passed it in — that guards against double-counting.
  const stillScheduled = new Set(existingIdentifiers);
  for (const snooze of existingSnoozes) {
    if (
      snooze.kind === 'snooze' &&
      stillScheduled.has(snooze.notificationId) &&
      !cancelledSet.has(snooze.notificationId) &&
      snooze.firesAt > now.getTime()
    ) {
      occurrences.push(snooze);
    }
  }

  const channelsInUse = new Set(
    alarms.map((alarm) => channelIdFor(alarm.soundId, alarm.vibrate))
  );
  await pruneUnusedChannels(channelsInUse);

  const scheduled = toSchedule.length - failed;
  logger.info(
    'scheduler',
    `Sync complete: ${scheduled} scheduled, ${cancelled} cancelled, ${failed} failed`
  );

  return { scheduled, cancelled, failed, occurrences };
}

/** Schedules a one-off snooze notification and returns its record. */
export async function scheduleSnooze(
  alarm: Alarm,
  settings: Settings,
  minutes: number,
  now: Date = new Date()
): Promise<ScheduledOccurrence | null> {
  const firesAt = now.getTime() + Math.max(1, Math.round(minutes)) * 60_000;
  const identifier = snoozeNotificationId(alarm.id, firesAt);
  return scheduleOne({ alarm, settings, firesAt, kind: 'snooze' }, identifier);
}

/** Cancels everything scheduled for one alarm (used on delete/disable). */
export async function cancelAlarm(alarmId: string): Promise<number> {
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const identifiers = existing
      .map((request) => request.identifier)
      .filter(
        (identifier) => isOwnedIdentifier(identifier) && alarmIdFromIdentifier(identifier) === alarmId
      );
    return await cancelMany(identifiers);
  } catch (error) {
    logger.error('scheduler', error);
    return 0;
  }
}

/** Cancels every notification this app owns (used by "reset all data"). */
export async function cancelAllOwned(): Promise<number> {
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    return await cancelMany(
      existing.map((request) => request.identifier).filter(isOwnedIdentifier)
    );
  } catch (error) {
    logger.error('scheduler', error);
    return 0;
  }
}

/** Cancels pending snoozes for one alarm without touching its main schedule. */
export async function cancelSnoozes(alarmId: string): Promise<number> {
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const identifiers = existing
      .map((request) => request.identifier)
      .filter(
        (identifier) =>
          identifier.startsWith(SNOOZE_PREFIX) && alarmIdFromIdentifier(identifier) === alarmId
      );
    return await cancelMany(identifiers);
  } catch (error) {
    logger.error('scheduler', error);
    return 0;
  }
}

/** Clears the notification an alarm left in the shade once it is handled. */
export async function dismissDeliveredFor(alarmId: string): Promise<void> {
  try {
    const presented = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      presented
        .filter((notification) => {
          const data = notification.request.content.data as Record<string, unknown> | undefined;
          return data?.alarmId === alarmId;
        })
        .map((notification) => Notifications.dismissNotificationAsync(notification.request.identifier))
    );
  } catch (error) {
    logger.warn('scheduler', `Could not dismiss delivered notifications: ${String(error)}`);
  }
}
