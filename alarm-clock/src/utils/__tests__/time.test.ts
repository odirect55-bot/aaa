import {
  findNextAlarm,
  formatCountdown,
  formatRelativeDay,
  formatRepeatDays,
  formatTime,
  nextOccurrence,
  nextOccurrences,
} from '../time';
import type { Alarm, Weekday } from '../../types/models';

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: 'alarm_1',
    hour: 7,
    minute: 0,
    label: '',
    repeatDays: [],
    soundId: 'classic_bell',
    vibrate: true,
    snoozeMinutes: 9,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

/**
 * `test/globalSetup.ts` pins the run to America/New_York so DST transitions
 * can be exercised. Assert that here: if the harness ever loses the setting,
 * the DST tests must fail loudly instead of silently passing in UTC.
 */
function expectDaylightSavingTimeZone() {
  const winter = new Date(2026, 0, 15).getTimezoneOffset();
  const summer = new Date(2026, 6, 15).getTimezoneOffset();
  expect([winter, summer]).toEqual([300, 240]);
}

describe('nextOccurrences', () => {
  it('returns today when the time is still ahead', () => {
    const now = new Date(2026, 3, 20, 6, 0); // Monday 06:00
    const [occurrence] = nextOccurrences(makeAlarm({ hour: 7, minute: 30 }), now, 1);

    expect(occurrence.getDate()).toBe(20);
    expect(occurrence.getHours()).toBe(7);
    expect(occurrence.getMinutes()).toBe(30);
  });

  it('rolls over to tomorrow once the time has passed', () => {
    const now = new Date(2026, 3, 20, 8, 0);
    const [occurrence] = nextOccurrences(makeAlarm({ hour: 7, minute: 30 }), now, 1);

    expect(occurrence.getDate()).toBe(21);
    expect(occurrence.getHours()).toBe(7);
  });

  it('treats "exactly now" as passed so an alarm never fires twice', () => {
    const now = new Date(2026, 3, 20, 7, 30, 0, 0);
    const [occurrence] = nextOccurrences(makeAlarm({ hour: 7, minute: 30 }), now, 1);

    expect(occurrence.getDate()).toBe(21);
  });

  it('yields exactly one occurrence for a non-repeating alarm', () => {
    const now = new Date(2026, 3, 20, 6, 0);
    expect(nextOccurrences(makeAlarm(), now, 5)).toHaveLength(1);
  });

  it('walks the repeat days in order', () => {
    const now = new Date(2026, 3, 20, 8, 0); // Monday, after 07:00
    const repeatDays: Weekday[] = [1, 3, 5]; // Mon, Wed, Fri
    const occurrences = nextOccurrences(makeAlarm({ repeatDays }), now, 4);

    expect(occurrences.map((date) => date.getDay())).toEqual([3, 5, 1, 3]);
    expect(occurrences.map((date) => date.getDate())).toEqual([22, 24, 27, 29]);
    occurrences.forEach((date) => expect(date.getHours()).toBe(7));
  });

  it('includes today when today is a repeat day and the time is ahead', () => {
    const now = new Date(2026, 3, 20, 6, 0); // Monday 06:00
    const [occurrence] = nextOccurrences(makeAlarm({ repeatDays: [1] }), now, 1);

    expect(occurrence.getDate()).toBe(20);
  });

  it('returns nothing when asked for zero occurrences', () => {
    expect(nextOccurrences(makeAlarm(), new Date(), 0)).toEqual([]);
  });

  it('keeps the wall-clock time across a spring-forward DST change', () => {
    expectDaylightSavingTimeZone();

    // US DST starts 08 March 2026 at 02:00 local time, so the pair of
    // occurrences either side of it are 7 March and 8 March.
    const now = new Date(2026, 2, 7, 6, 0);
    const occurrences = nextOccurrences(
      makeAlarm({ hour: 7, minute: 0, repeatDays: [0, 1, 2, 3, 4, 5, 6] }),
      now,
      2
    );

    occurrences.forEach((date) => expect(date.getHours()).toBe(7));
    // The day the clocks jump forward is only 23 hours long, and the alarm
    // still rings at 07:00 rather than drifting to 08:00.
    const deltaHours = (occurrences[1].getTime() - occurrences[0].getTime()) / (60 * 60 * 1000);
    expect(deltaHours).toBe(23);
  });

  it('keeps the wall-clock time across a fall-back DST change', () => {
    expectDaylightSavingTimeZone();

    // US DST ends 01 November 2026 at 02:00 local time.
    const now = new Date(2026, 9, 31, 6, 0);
    const occurrences = nextOccurrences(
      makeAlarm({ hour: 7, minute: 0, repeatDays: [0, 1, 2, 3, 4, 5, 6] }),
      now,
      2
    );

    occurrences.forEach((date) => expect(date.getHours()).toBe(7));
    const deltaHours = (occurrences[1].getTime() - occurrences[0].getTime()) / (60 * 60 * 1000);
    expect(deltaHours).toBe(25);
  });
});

describe('nextOccurrence / findNextAlarm', () => {
  it('ignores disabled alarms', () => {
    expect(nextOccurrence(makeAlarm({ enabled: false }), new Date())).toBeNull();
  });

  it('picks the soonest enabled alarm', () => {
    const now = new Date(2026, 3, 20, 6, 0);
    const early = makeAlarm({ id: 'early', hour: 6, minute: 30 });
    const late = makeAlarm({ id: 'late', hour: 9, minute: 0 });
    const off = makeAlarm({ id: 'off', hour: 6, minute: 15, enabled: false });

    expect(findNextAlarm([late, off, early], now)?.alarm.id).toBe('early');
  });

  it('returns null when nothing is armed', () => {
    expect(findNextAlarm([makeAlarm({ enabled: false })], new Date())).toBeNull();
  });
});

describe('formatting', () => {
  it('formats 12-hour times with midnight and noon as 12', () => {
    expect(formatTime(0, 5, false)).toBe('12:05');
    expect(formatTime(12, 0, false)).toBe('12:00');
    expect(formatTime(13, 7, false)).toBe('1:07');
  });

  it('zero-pads 24-hour times', () => {
    expect(formatTime(0, 5, true)).toBe('00:05');
    expect(formatTime(13, 7, true)).toBe('13:07');
  });

  it('names the common repeat patterns', () => {
    expect(formatRepeatDays([])).toBe('Once');
    expect(formatRepeatDays([0, 1, 2, 3, 4, 5, 6])).toBe('Every day');
    expect(formatRepeatDays([1, 2, 3, 4, 5])).toBe('Weekdays');
    expect(formatRepeatDays([0, 6])).toBe('Weekends');
    expect(formatRepeatDays([2, 4])).toBe('Tue, Thu');
  });

  it('rounds the countdown up so it never reads zero while pending', () => {
    const from = new Date(2026, 3, 20, 6, 0);
    expect(formatCountdown(new Date(2026, 3, 20, 6, 0, 30), from)).toBe('in 1 min');
    expect(formatCountdown(new Date(2026, 3, 20, 7, 20), from)).toBe('in 1 hr 20 min');
    expect(formatCountdown(new Date(2026, 3, 22, 6, 0), from)).toBe('in 2 d');
    expect(formatCountdown(new Date(2026, 3, 20, 5, 0), from)).toBe('now');
  });

  it('labels today and tomorrow', () => {
    const from = new Date(2026, 3, 20, 22, 0);
    expect(formatRelativeDay(new Date(2026, 3, 20, 23, 0), from)).toBe('Today');
    expect(formatRelativeDay(new Date(2026, 3, 21, 7, 0), from)).toBe('Tomorrow');
    expect(formatRelativeDay(new Date(2026, 3, 25, 7, 0), from)).toBe('Sat 25 Apr');
  });
});
