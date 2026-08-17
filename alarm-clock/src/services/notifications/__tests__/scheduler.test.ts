import type { Alarm, HistoryEntry, ScheduledOccurrence } from '../../../types/models';
import { DEFAULT_SETTINGS } from '../../../types/models';

jest.mock('expo-notifications', () => require('../../../../test/fakeNotifications'));

import { __reset, fakeState } from '../../../../test/fakeNotifications';
import {
  alarmIdFromIdentifier,
  alarmNotificationId,
  cancelAlarm,
  diffSchedule,
  isOwnedIdentifier,
  MISSED_GRACE_MS,
  OCCURRENCES_AHEAD,
  planAll,
  planForAlarm,
  reconcilePastOccurrences,
  scheduleSnooze,
  snoozeNotificationId,
  syncSchedule,
} from '../scheduler';

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: 'alarm_1',
    hour: 7,
    minute: 0,
    label: 'Wake up',
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

const NOW = new Date(2026, 3, 20, 6, 0); // Monday 06:00

beforeEach(() => {
  __reset();
});

describe('identifiers', () => {
  it('round-trips the alarm id', () => {
    const identifier = alarmNotificationId('alarm_abc123', 1_700_000_000_000);
    expect(isOwnedIdentifier(identifier)).toBe(true);
    expect(alarmIdFromIdentifier(identifier)).toBe('alarm_abc123');
  });

  it('round-trips snooze identifiers and ids containing dots', () => {
    const identifier = snoozeNotificationId('legacy.id.7', 1_700_000_000_000);
    expect(alarmIdFromIdentifier(identifier)).toBe('legacy.id.7');
  });

  it('ignores identifiers owned by anything else', () => {
    expect(isOwnedIdentifier('some-other-app-notification')).toBe(false);
    expect(alarmIdFromIdentifier('some-other-app-notification')).toBeNull();
  });
});

describe('planning', () => {
  it('plans nothing for a disabled alarm', () => {
    expect(planForAlarm(makeAlarm({ enabled: false }), NOW)).toEqual([]);
  });

  it('plans a single occurrence for a one-shot alarm', () => {
    expect(planForAlarm(makeAlarm(), NOW)).toHaveLength(1);
  });

  it('plans a rolling window for a repeating alarm', () => {
    const plan = planForAlarm(makeAlarm({ repeatDays: [0, 1, 2, 3, 4, 5, 6] }), NOW);
    expect(plan).toHaveLength(OCCURRENCES_AHEAD);
    expect(new Set(plan.map((item) => item.identifier)).size).toBe(OCCURRENCES_AHEAD);
    // Strictly increasing, one day apart.
    for (let index = 1; index < plan.length; index += 1) {
      expect(plan[index].firesAt).toBeGreaterThan(plan[index - 1].firesAt);
    }
  });

  it('is deterministic, so replanning produces the same identifiers', () => {
    const first = planAll([makeAlarm({ repeatDays: [1, 4] })], NOW);
    const second = planAll([makeAlarm({ repeatDays: [1, 4] })], NOW);
    expect(second.map((item) => item.identifier)).toEqual(first.map((item) => item.identifier));
  });
});

describe('diffSchedule', () => {
  const planned = planAll([makeAlarm({ id: 'a', repeatDays: [1] })], NOW);
  const liveAlarms = new Set(['a']);

  it('schedules everything when nothing exists yet', () => {
    const { toSchedule, toCancel } = diffSchedule(planned, [], liveAlarms);
    expect(toSchedule).toHaveLength(planned.length);
    expect(toCancel).toEqual([]);
  });

  it('adds nothing when the plan is already scheduled', () => {
    const existing = planned.map((item) => item.identifier);
    const { toSchedule, toCancel } = diffSchedule(planned, existing, liveAlarms);
    expect(toSchedule).toEqual([]);
    expect(toCancel).toEqual([]);
  });

  it('cancels stale alarm notifications that are no longer planned', () => {
    const stale = alarmNotificationId('a', NOW.getTime() - 1000);
    const { toCancel } = diffSchedule(planned, [stale], liveAlarms);
    expect(toCancel).toEqual([stale]);
  });

  it('never touches notifications belonging to other apps', () => {
    const { toCancel } = diffSchedule(planned, ['foreign-notification'], liveAlarms);
    expect(toCancel).toEqual([]);
  });

  it('keeps a pending snooze for a live alarm but drops orphaned ones', () => {
    const liveSnooze = snoozeNotificationId('a', NOW.getTime() + 60_000);
    const orphanSnooze = snoozeNotificationId('deleted', NOW.getTime() + 60_000);

    const { toCancel } = diffSchedule(planned, [liveSnooze, orphanSnooze], liveAlarms);
    expect(toCancel).toEqual([orphanSnooze]);
  });
});

describe('syncSchedule against a fake OS', () => {
  it('schedules a repeating alarm once and stays idempotent', async () => {
    const alarms = [makeAlarm({ repeatDays: [0, 1, 2, 3, 4, 5, 6] })];

    const first = await syncSchedule(alarms, DEFAULT_SETTINGS);
    expect(first.scheduled).toBe(OCCURRENCES_AHEAD);
    expect(first.failed).toBe(0);
    expect(fakeState.scheduled.size).toBe(OCCURRENCES_AHEAD);

    const callsAfterFirst = fakeState.scheduleCalls;
    const second = await syncSchedule(alarms, DEFAULT_SETTINGS, first.occurrences);

    expect(second.scheduled).toBe(0);
    expect(second.cancelled).toBe(0);
    expect(fakeState.scheduleCalls).toBe(callsAfterFirst);
    // The crucial property: no duplicates for the same occurrence.
    expect(fakeState.scheduled.size).toBe(OCCURRENCES_AHEAD);
    expect(second.occurrences).toHaveLength(OCCURRENCES_AHEAD);
  });

  it('cancels everything when an alarm is switched off', async () => {
    const alarm = makeAlarm({ repeatDays: [1, 3] });
    await syncSchedule([alarm], DEFAULT_SETTINGS);
    expect(fakeState.scheduled.size).toBeGreaterThan(0);

    const result = await syncSchedule([{ ...alarm, enabled: false }], DEFAULT_SETTINGS);
    expect(result.cancelled).toBeGreaterThan(0);
    expect(fakeState.scheduled.size).toBe(0);
    expect(result.occurrences).toEqual([]);
  });

  it('reschedules after an edit without leaving the old time behind', async () => {
    const alarm = makeAlarm({ repeatDays: [1] });
    const first = await syncSchedule([alarm], DEFAULT_SETTINGS);
    const originalIds = new Set(first.occurrences.map((item) => item.notificationId));

    const edited = { ...alarm, hour: 9, minute: 45 };
    await cancelAlarm(edited.id);
    const second = await syncSchedule([edited], DEFAULT_SETTINGS);

    const newIds = second.occurrences.map((item) => item.notificationId);
    expect(newIds.some((identifier) => originalIds.has(identifier))).toBe(false);
    expect(fakeState.scheduled.size).toBe(newIds.length);
    for (const request of fakeState.scheduled.values()) {
      expect(new Date(request.trigger.date as number).getHours()).toBe(9);
      expect(new Date(request.trigger.date as number).getMinutes()).toBe(45);
    }
  });

  it('attaches the alarm payload, category and channel to each notification', async () => {
    const alarm = makeAlarm({ id: 'payload_alarm' });
    await syncSchedule([alarm], DEFAULT_SETTINGS);

    const [request] = [...fakeState.scheduled.values()];
    expect(request.content).toMatchObject({
      title: 'Wake up',
      categoryIdentifier: 'alarm-ringing',
      sticky: true,
      autoDismiss: false,
    });
    expect(request.content.data).toMatchObject({
      type: 'alarm',
      alarmId: 'payload_alarm',
      kind: 'alarm',
    });
    expect(request.trigger.type).toBe('date');
    // Android: the channel carries the chosen tone.
    expect(request.trigger.channelId).toBe('alarm.v1.classic_bell.vibrate');
    expect(fakeState.channels.get('alarm.v1.classic_bell.vibrate')).toMatchObject({
      sound: 'classic_bell.wav',
      importance: 7,
    });
  });

  it('reports failures instead of throwing', async () => {
    fakeState.scheduleShouldFail = true;
    const result = await syncSchedule([makeAlarm()], DEFAULT_SETTINGS);

    expect(result.failed).toBe(1);
    expect(result.scheduled).toBe(0);
    expect(result.occurrences).toEqual([]);
  });

  it('keeps a pending snooze across a sync', async () => {
    const alarm = makeAlarm({ repeatDays: [1] });
    const synced = await syncSchedule([alarm], DEFAULT_SETTINGS);

    const snooze = await scheduleSnooze(alarm, DEFAULT_SETTINGS, 9);
    expect(snooze).not.toBeNull();
    expect(snooze?.kind).toBe('snooze');

    const after = await syncSchedule([alarm], DEFAULT_SETTINGS, [
      ...synced.occurrences.filter((item) => item.kind === 'snooze'),
      snooze!,
    ]);

    expect(after.occurrences.some((item) => item.notificationId === snooze!.notificationId)).toBe(
      true
    );
    expect(fakeState.scheduled.has(snooze!.notificationId)).toBe(true);
  });

  it('cancelAlarm removes both alarm and snooze notifications for that alarm', async () => {
    const alarm = makeAlarm({ id: 'target', repeatDays: [1] });
    const other = makeAlarm({ id: 'other', repeatDays: [2] });
    await syncSchedule([alarm, other], DEFAULT_SETTINGS);
    await scheduleSnooze(alarm, DEFAULT_SETTINGS, 5);

    await cancelAlarm('target');

    const remaining = [...fakeState.scheduled.keys()];
    expect(remaining.every((identifier) => alarmIdFromIdentifier(identifier) === 'other')).toBe(true);
    expect(remaining.length).toBeGreaterThan(0);
  });
});

describe('reconcilePastOccurrences', () => {
  const now = new Date(2026, 3, 20, 8, 0);
  const past = now.getTime() - 30 * 60_000;

  function occurrence(overrides: Partial<ScheduledOccurrence> = {}): ScheduledOccurrence {
    return {
      notificationId: alarmNotificationId('alarm_1', past),
      alarmId: 'alarm_1',
      firesAt: past,
      kind: 'alarm',
      ...overrides,
    };
  }

  it('records an unattended past occurrence as missed', () => {
    const result = reconcilePastOccurrences([makeAlarm()], [occurrence()], [], now);

    expect(result.missedEntries).toHaveLength(1);
    expect(result.missedEntries[0]).toMatchObject({ alarmId: 'alarm_1', action: 'missed' });
    expect(result.remaining).toEqual([]);
  });

  it('does not duplicate an occurrence the user already handled', () => {
    const history: HistoryEntry[] = [
      {
        id: 'history_1',
        alarmId: 'alarm_1',
        label: 'Wake up',
        scheduledFor: past,
        recordedAt: past,
        action: 'dismissed',
      },
    ];

    const result = reconcilePastOccurrences([makeAlarm()], [occurrence()], history, now);
    expect(result.missedEntries).toEqual([]);
  });

  it('switches off a one-shot alarm whose occurrence has passed', () => {
    const result = reconcilePastOccurrences([makeAlarm()], [occurrence()], [], now);
    expect(result.alarmIdsToDisable).toEqual(['alarm_1']);
  });

  it('leaves repeating alarms armed', () => {
    const result = reconcilePastOccurrences(
      [makeAlarm({ repeatDays: [1, 2, 3] })],
      [occurrence()],
      [],
      now
    );
    expect(result.alarmIdsToDisable).toEqual([]);
  });

  it('leaves a just-fired alarm alone so the ringing screen can handle it', () => {
    const justNow = now.getTime() - MISSED_GRACE_MS / 2;
    const result = reconcilePastOccurrences(
      [makeAlarm()],
      [occurrence({ firesAt: justNow })],
      [],
      now
    );

    expect(result.missedEntries).toEqual([]);
    expect(result.remaining).toHaveLength(1);
  });

  it('keeps future occurrences untouched', () => {
    const future = now.getTime() + 60 * 60_000;
    const result = reconcilePastOccurrences(
      [makeAlarm()],
      [occurrence({ firesAt: future })],
      [],
      now
    );

    expect(result.remaining).toHaveLength(1);
    expect(result.missedEntries).toEqual([]);
    expect(result.alarmIdsToDisable).toEqual([]);
  });

  it('drops occurrences for alarms that no longer exist', () => {
    const result = reconcilePastOccurrences([], [occurrence()], [], now);
    expect(result.missedEntries).toEqual([]);
    expect(result.remaining).toEqual([]);
  });
});
