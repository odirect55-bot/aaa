import type { Alarm, Weekday } from '../types/models';

const MINUTE_MS = 60_000;

export const DAY_LABELS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const DAY_LABELS_MEDIUM = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LABELS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const WEEKDAY_SET: Weekday[] = [1, 2, 3, 4, 5];
const WEEKEND_SET: Weekday[] = [0, 6];

/**
 * Builds a local `Date` for a wall-clock time on a given day.
 *
 * Using the `Date` constructor (rather than epoch arithmetic) is deliberate:
 * it resolves the wall-clock time in whatever offset is in effect on that day,
 * so an alarm set for 07:00 stays at 07:00 across daylight-saving changes.
 */
export function atLocalTime(reference: Date, dayOffset: number, hour: number, minute: number): Date {
  return new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate() + dayOffset,
    hour,
    minute,
    0,
    0
  );
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The next `count` times this alarm should ring, strictly after `from`.
 *
 * A non-repeating alarm yields exactly one occurrence. A repeating alarm walks
 * forward day by day; the 7-day window guarantees a hit for any non-empty
 * repeat set, and the `* 8` bound keeps the loop finite no matter what.
 */
export function nextOccurrences(
  alarm: Pick<Alarm, 'hour' | 'minute' | 'repeatDays'>,
  from: Date,
  count: number
): Date[] {
  if (count <= 0) {
    return [];
  }

  const occurrences: Date[] = [];

  if (alarm.repeatDays.length === 0) {
    const today = atLocalTime(from, 0, alarm.hour, alarm.minute);
    occurrences.push(today.getTime() > from.getTime() ? today : atLocalTime(from, 1, alarm.hour, alarm.minute));
    return occurrences;
  }

  const repeatDays = new Set<number>(alarm.repeatDays);
  const maxDaysToScan = 7 * count + 8;

  for (let dayOffset = 0; dayOffset < maxDaysToScan && occurrences.length < count; dayOffset += 1) {
    const candidate = atLocalTime(from, dayOffset, alarm.hour, alarm.minute);
    if (candidate.getTime() <= from.getTime()) {
      continue;
    }
    if (repeatDays.has(candidate.getDay())) {
      occurrences.push(candidate);
    }
  }

  return occurrences;
}

/** Convenience wrapper: the single next ring time, or `null` when disabled. */
export function nextOccurrence(alarm: Alarm, from: Date = new Date()): Date | null {
  if (!alarm.enabled) {
    return null;
  }
  return nextOccurrences(alarm, from, 1)[0] ?? null;
}

/** The soonest upcoming alarm across the list, ignoring disabled ones. */
export function findNextAlarm(
  alarms: Alarm[],
  from: Date = new Date()
): { alarm: Alarm; date: Date } | null {
  let best: { alarm: Alarm; date: Date } | null = null;

  for (const alarm of alarms) {
    const date = nextOccurrence(alarm, from);
    if (!date) {
      continue;
    }
    if (!best || date.getTime() < best.date.getTime()) {
      best = { alarm, date };
    }
  }

  return best;
}

export function formatTime(hour: number, minute: number, use24HourClock: boolean): string {
  const paddedMinute = String(minute).padStart(2, '0');
  if (use24HourClock) {
    return `${String(hour).padStart(2, '0')}:${paddedMinute}`;
  }
  const normalisedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalisedHour}:${paddedMinute}`;
}

export function formatMeridiem(hour: number): 'AM' | 'PM' {
  return hour < 12 ? 'AM' : 'PM';
}

export function formatDateTime(date: Date, use24HourClock: boolean): string {
  const time = formatTime(date.getHours(), date.getMinutes(), use24HourClock);
  const suffix = use24HourClock ? '' : ` ${formatMeridiem(date.getHours())}`;
  return `${DAY_LABELS_MEDIUM[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}${suffix}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mon, Wed, Fri" / "Every day" / "Weekdays" / "Once". */
export function formatRepeatDays(repeatDays: Weekday[]): string {
  if (repeatDays.length === 0) {
    return 'Once';
  }
  if (repeatDays.length === 7) {
    return 'Every day';
  }

  const sorted = [...repeatDays].sort((a, b) => a - b);
  if (sameDays(sorted, WEEKDAY_SET)) {
    return 'Weekdays';
  }
  if (sameDays(sorted, WEEKEND_SET)) {
    return 'Weekends';
  }
  return sorted.map((day) => DAY_LABELS_MEDIUM[day]).join(', ');
}

function sameDays(a: Weekday[], b: Weekday[]): boolean {
  return a.length === b.length && a.every((day, index) => day === b[index]);
}

/**
 * "in 7 hr 20 min" style copy for the next-alarm indicator. Rounds up so the
 * countdown never reads "in 0 min" while the alarm is still pending.
 */
export function formatCountdown(target: Date, from: Date = new Date()): string {
  const deltaMs = target.getTime() - from.getTime();
  if (deltaMs <= 0) {
    return 'now';
  }

  const totalMinutes = Math.ceil(deltaMs / MINUTE_MS);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return hours > 0 ? `in ${days} d ${hours} hr` : `in ${days} d`;
  }
  if (hours > 0) {
    return minutes > 0 ? `in ${hours} hr ${minutes} min` : `in ${hours} hr`;
  }
  return `in ${minutes} min`;
}

/** "Today" / "Tomorrow" / "Sat 12 Apr" for the next occurrence of an alarm. */
export function formatRelativeDay(target: Date, from: Date = new Date()): string {
  if (isSameLocalDay(target, from)) {
    return 'Today';
  }
  const tomorrow = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1);
  if (isSameLocalDay(target, tomorrow)) {
    return 'Tomorrow';
  }
  return `${DAY_LABELS_MEDIUM[target.getDay()]} ${target.getDate()} ${MONTHS[target.getMonth()]}`;
}

/** Minutes-since-midnight, used to compare wall-clock times. */
export function toMinutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/**
 * Identifies the device's current time context. A change here (travelling
 * across time zones, a manual clock change, or a DST transition) invalidates
 * every previously computed trigger date, so the app resyncs when it changes.
 */
export function currentTimeContext(now: Date = new Date()): string {
  let zone = 'unknown';
  try {
    zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'unknown';
  } catch {
    // Intl is always present in Hermes, but never let this throw.
  }
  return `${zone}@${now.getTimezoneOffset()}`;
}
