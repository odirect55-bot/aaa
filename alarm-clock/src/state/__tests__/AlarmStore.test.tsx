import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AppState } from 'react-native';

import type { AlarmDraft } from '../../types/models';

jest.mock('expo-notifications', () => require('../../../test/fakeNotifications'));
jest.mock('expo-audio', () => require('../../../test/fakeAudio'));

import {
  __fire,
  __reset,
  __respond,
  __setColdStartResponse,
  DEFAULT_ACTION_IDENTIFIER,
  fakeState,
  type FakeNotification,
} from '../../../test/fakeNotifications';
import {
  ALARM_PREFIX,
  OCCURRENCES_AHEAD,
  SNOOZE_PREFIX,
} from '../../services/notifications/scheduler';
import { AlarmStoreProvider, useAlarmStore, type AlarmStore } from '../AlarmStore';

/**
 * End-to-end tests for the store: every user-facing feature is driven through
 * the same API the screens use, against an in-memory AsyncStorage and a fake
 * of the OS notification scheduler.
 */

let store: AlarmStore;

function Harness() {
  store = useAlarmStore();
  return null;
}

async function mountApp() {
  const view = await render(
    <AlarmStoreProvider>
      <Harness />
    </AlarmStoreProvider>
  );
  await waitFor(() => expect(store.ready).toBe(true));
  return view;
}

function draft(overrides: Partial<AlarmDraft> = {}): AlarmDraft {
  return {
    hour: 7,
    minute: 30,
    label: 'Wake up',
    repeatDays: [],
    soundId: 'classic_bell',
    vibrate: true,
    snoozeMinutes: 9,
    enabled: true,
    ...overrides,
  };
}

function scheduledIds(): string[] {
  return [...fakeState.scheduled.keys()];
}

function alarmIds(): string[] {
  return scheduledIds().filter((id) => id.startsWith(ALARM_PREFIX));
}

function snoozeIds(): string[] {
  return scheduledIds().filter((id) => id.startsWith(SNOOZE_PREFIX));
}

/** Simulates the app being sent to the background and reopened. */
async function foregroundApp() {
  await act(async () => {
    emitAppState('background');
    emitAppState('active');
  });
}

let appStateHandlers: ((state: string) => void)[] = [];

function emitAppState(state: string) {
  appStateHandlers.forEach((handler) => handler(state));
}

beforeEach(async () => {
  __reset();
  await AsyncStorage.clear();
  appStateHandlers = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, handler) => {
    if (event === 'change') {
      appStateHandlers.push(handler as (state: string) => void);
    }
    return {
      remove: () => {
        appStateHandlers = appStateHandlers.filter((item) => item !== handler);
      },
    } as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('creating alarms', () => {
  it('persists the alarm and schedules it with the OS', async () => {
    await mountApp();

    await act(async () => {
      await store.addAlarm(draft({ hour: 6, minute: 15, label: 'Gym' }));
    });

    expect(store.alarms).toHaveLength(1);
    expect(store.alarms[0]).toMatchObject({ hour: 6, minute: 15, label: 'Gym', enabled: true });

    const stored = JSON.parse((await AsyncStorage.getItem('alarmclock:alarms')) ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].label).toBe('Gym');

    expect(alarmIds()).toHaveLength(1);
    const fired = new Date(
      [...fakeState.scheduled.values()][0].trigger.date as number
    );
    expect(fired.getHours()).toBe(6);
    expect(fired.getMinutes()).toBe(15);
    expect(fired.getTime()).toBeGreaterThan(Date.now());
  });

  it('trims and clamps the input before storing it', async () => {
    await mountApp();

    await act(async () => {
      await store.addAlarm(draft({ label: '   Run   ', repeatDays: [3, 1, 3] as never }));
    });

    expect(store.alarms[0].label).toBe('Run');
    expect(store.alarms[0].repeatDays).toEqual([1, 3]);
  });

  it('rejects an alarm that can neither sound nor vibrate', async () => {
    await mountApp();

    await expect(
      act(async () => {
        await store.addAlarm(draft({ soundId: 'silent', vibrate: false }));
      })
    ).rejects.toThrow(/vibration/i);

    expect(store.alarms).toHaveLength(0);
    expect(scheduledIds()).toHaveLength(0);
  });

  it('asks for notification permission when the first alarm is saved', async () => {
    fakeState.permissions = { granted: false, canAskAgain: true, status: 'undetermined' };
    await mountApp();
    expect(fakeState.permissionRequests).toBe(0);

    await act(async () => {
      await store.addAlarm(draft());
    });

    expect(fakeState.permissionRequests).toBe(1);
  });

  it('still saves the alarm when permission is refused, and reports it', async () => {
    fakeState.permissions = { granted: false, canAskAgain: false, status: 'denied' };
    await mountApp();

    await act(async () => {
      await store.addAlarm(draft());
    });

    expect(store.alarms).toHaveLength(1);
    expect(store.permission.granted).toBe(false);
  });
});

describe('repeating alarms', () => {
  it('keeps a window of future occurrences on the right weekdays', async () => {
    await mountApp();

    await act(async () => {
      await store.addAlarm(draft({ hour: 7, minute: 0, repeatDays: [1, 3, 5] }));
    });

    const dates = [...fakeState.scheduled.values()].map(
      (request) => new Date(request.trigger.date as number)
    );

    expect(dates).toHaveLength(OCCURRENCES_AHEAD);
    dates.forEach((date) => {
      expect([1, 3, 5]).toContain(date.getDay());
      expect(date.getHours()).toBe(7);
      expect(date.getMinutes()).toBe(0);
      expect(date.getTime()).toBeGreaterThan(Date.now());
    });
    // Strictly increasing and unique.
    const times = dates.map((date) => date.getTime()).sort((a, b) => a - b);
    expect(new Set(times).size).toBe(OCCURRENCES_AHEAD);
  });

  it('does not accumulate duplicates when the app is reopened repeatedly', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ repeatDays: [0, 1, 2, 3, 4, 5, 6] }));
    });

    const afterCreate = scheduledIds().sort();
    await foregroundApp();
    await foregroundApp();

    expect(scheduledIds().sort()).toEqual(afterCreate);
  });

  it('stays armed after firing, unlike a one-shot alarm', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ repeatDays: [0, 1, 2, 3, 4, 5, 6] }));
    });

    const notification = __fire(alarmIds()[0]);
    await act(async () => {
      __respond(notification, 'dismiss');
    });

    expect(store.alarms[0].enabled).toBe(true);
    expect(alarmIds().length).toBeGreaterThan(0);
  });
});

describe('editing alarms', () => {
  it('reschedules at the new time and leaves nothing behind at the old one', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ hour: 6, minute: 0, repeatDays: [1, 2, 3, 4, 5] }));
    });
    const before = new Set(alarmIds());

    await act(async () => {
      await store.updateAlarm(store.alarms[0].id, draft({ hour: 9, minute: 45, repeatDays: [6] }));
    });

    const after = alarmIds();
    expect(after.some((id) => before.has(id))).toBe(false);
    for (const request of fakeState.scheduled.values()) {
      const date = new Date(request.trigger.date as number);
      expect(date.getHours()).toBe(9);
      expect(date.getMinutes()).toBe(45);
      expect(date.getDay()).toBe(6);
    }
  });

  it('applies a sound change to the notification channel', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ soundId: 'classic_bell', vibrate: true }));
    });
    expect([...fakeState.scheduled.values()][0].trigger.channelId).toBe(
      'alarm.v1.classic_bell.vibrate'
    );

    await act(async () => {
      await store.updateAlarm(store.alarms[0].id, draft({ soundId: 'radar', vibrate: false }));
    });

    const request = [...fakeState.scheduled.values()][0];
    expect(request.trigger.channelId).toBe('alarm.v1.radar.still');
    expect(fakeState.channels.get('alarm.v1.radar.still')).toMatchObject({
      sound: 'radar.wav',
      enableVibrate: false,
    });
    // The channel nobody uses any more is cleaned up.
    expect(fakeState.channels.has('alarm.v1.classic_bell.vibrate')).toBe(false);
  });

  it('persists the edit', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ label: 'Old' }));
    });
    await act(async () => {
      await store.updateAlarm(store.alarms[0].id, draft({ label: 'New', hour: 8 }));
    });

    const stored = JSON.parse((await AsyncStorage.getItem('alarmclock:alarms')) ?? '[]');
    expect(stored[0]).toMatchObject({ label: 'New', hour: 8 });
  });

  it('rejects an invalid edit without touching the schedule', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft());
    });
    const before = scheduledIds();

    await expect(
      act(async () => {
        await store.updateAlarm(store.alarms[0].id, draft({ soundId: 'nope' as never }));
      })
    ).rejects.toThrow();

    expect(scheduledIds()).toEqual(before);
  });
});

describe('deleting and toggling alarms', () => {
  it('cancels everything when an alarm is deleted', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ repeatDays: [1, 2] }));
      await store.addAlarm(draft({ hour: 9, repeatDays: [3] }));
    });
    expect(store.alarms).toHaveLength(2);

    const victim = store.alarms[0];
    await act(async () => {
      await store.deleteAlarm(victim.id);
    });

    expect(store.alarms).toHaveLength(1);
    expect(scheduledIds().some((id) => id.includes(victim.id))).toBe(false);
    expect(scheduledIds().length).toBeGreaterThan(0);

    const stored = JSON.parse((await AsyncStorage.getItem('alarmclock:alarms')) ?? '[]');
    expect(stored).toHaveLength(1);
  });

  it('unschedules when disabled and reschedules when enabled again', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ repeatDays: [1, 3] }));
    });
    const id = store.alarms[0].id;
    expect(alarmIds().length).toBeGreaterThan(0);

    await act(async () => {
      await store.setAlarmEnabled(id, false);
    });
    expect(scheduledIds()).toHaveLength(0);
    expect(store.alarms[0].enabled).toBe(false);

    await act(async () => {
      await store.setAlarmEnabled(id, true);
    });
    expect(alarmIds()).toHaveLength(OCCURRENCES_AHEAD);
    expect(store.alarms[0].enabled).toBe(true);
  });

  it('keeps a disabled alarm out of the schedule across a reopen', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ enabled: false, repeatDays: [2] }));
    });

    await foregroundApp();
    expect(scheduledIds()).toHaveLength(0);
  });
});

describe('ringing, snooze and dismiss', () => {
  async function createAndFire(overrides: Partial<AlarmDraft> = {}): Promise<FakeNotification> {
    await act(async () => {
      await store.addAlarm(draft(overrides));
    });
    const identifier = alarmIds()[0];
    let notification!: FakeNotification;
    await act(async () => {
      notification = __fire(identifier);
    });
    return notification;
  }

  it('shows the ringing screen when a notification is delivered', async () => {
    await mountApp();
    await createAndFire();

    expect(store.ringing).not.toBeNull();
    expect(store.ringing?.alarm.label).toBe('Wake up');
    expect(store.ringing?.kind).toBe('alarm');
  });

  it('snoozes for the alarm\'s own snooze length and logs it', async () => {
    await mountApp();
    await createAndFire({ snoozeMinutes: 9 });

    const before = Date.now();
    await act(async () => {
      await store.snoozeRinging();
    });

    expect(store.ringing).toBeNull();
    const snoozes = snoozeIds();
    expect(snoozes).toHaveLength(1);

    const firesAt = fakeState.scheduled.get(snoozes[0])!.trigger.date as number;
    const minutesAhead = (firesAt - before) / 60_000;
    expect(minutesAhead).toBeGreaterThan(8.9);
    expect(minutesAhead).toBeLessThan(9.2);

    expect(store.history[0]).toMatchObject({ action: 'snoozed' });
    // The delivered notification is cleared from the shade.
    expect(fakeState.presented).toHaveLength(0);
  });

  it('records a dismissal, not a snooze, when the snooze cannot be scheduled', async () => {
    await mountApp();
    await createAndFire({ snoozeMinutes: 9 });

    fakeState.scheduleShouldFail = true;
    await act(async () => {
      await store.snoozeRinging();
    });

    expect(snoozeIds()).toHaveLength(0);
    expect(store.history[0]).toMatchObject({ action: 'dismissed' });
    await waitFor(() => expect(store.lastSyncError).toMatch(/snooze/i));
  });

  it('dismisses instead of snoozing when snooze is switched off', async () => {
    await mountApp();
    await createAndFire({ snoozeMinutes: 0 });

    await act(async () => {
      await store.snoozeRinging();
    });

    expect(snoozeIds()).toHaveLength(0);
    expect(store.history[0]).toMatchObject({ action: 'dismissed' });
  });

  it('omits the Snooze button from a notification that cannot be snoozed', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ snoozeMinutes: 0 }));
    });

    const request = [...fakeState.scheduled.values()][0];
    expect(request.content.categoryIdentifier).toBe('alarm-ringing-no-snooze');
    expect(fakeState.categories.get('alarm-ringing-no-snooze')).toHaveLength(1);
    expect(fakeState.categories.get('alarm-ringing')).toHaveLength(2);
  });

  it('replaces an existing snooze rather than stacking a second one', async () => {
    await mountApp();
    const notification = await createAndFire({ snoozeMinutes: 5 });

    await act(async () => {
      await store.snoozeRinging();
    });
    expect(snoozeIds()).toHaveLength(1);

    // The snooze fires, and the user snoozes again.
    let snoozeNotification!: FakeNotification;
    await act(async () => {
      snoozeNotification = __fire(snoozeIds()[0]);
    });
    expect(store.ringing?.kind).toBe('snooze');
    await act(async () => {
      await store.snoozeRinging();
    });

    expect(snoozeIds()).toHaveLength(1);
    expect(snoozeNotification.request.identifier).not.toBe(notification.request.identifier);
  });

  it('keeps a pending snooze alive when a one-shot alarm switches itself off', async () => {
    await mountApp();
    await createAndFire({ repeatDays: [], snoozeMinutes: 9 });

    await act(async () => {
      await store.snoozeRinging();
    });
    const snooze = snoozeIds()[0];
    expect(snooze).toBeDefined();

    // Age the fired occurrence past the reconciliation grace period, the way
    // it looks when the user reopens the app a few minutes after snoozing.
    // Reconciliation then switches the one-shot alarm off — and the snooze the
    // user is relying on has to survive that.
    const stored = JSON.parse((await AsyncStorage.getItem('alarmclock:schedule')) ?? '[]');
    await AsyncStorage.setItem(
      'alarmclock:schedule',
      JSON.stringify(
        stored.map((item: { kind: string; firesAt: number }) =>
          item.kind === 'alarm' ? { ...item, firesAt: Date.now() - 600_000 } : item
        )
      )
    );

    await mountApp();

    expect(store.alarms[0].enabled).toBe(false);
    expect(snoozeIds()).toEqual([snooze]);
    expect(fakeState.scheduled.has(snooze)).toBe(true);
  });

  it('dismisses, records history and switches a one-shot alarm off', async () => {
    await mountApp();
    await createAndFire({ repeatDays: [] });

    await act(async () => {
      await store.dismissRinging();
    });

    expect(store.ringing).toBeNull();
    expect(store.history[0]).toMatchObject({ action: 'dismissed', label: 'Wake up' });
    expect(store.alarms[0].enabled).toBe(false);
    expect(scheduledIds()).toHaveLength(0);

    const storedHistory = JSON.parse((await AsyncStorage.getItem('alarmclock:history')) ?? '[]');
    expect(storedHistory[0].action).toBe('dismissed');
  });

  it('handles Snooze and Dismiss pressed on the notification itself', async () => {
    await mountApp();
    const notification = await createAndFire({ snoozeMinutes: 5, repeatDays: [1, 2, 3] });

    await act(async () => {
      __respond(notification, 'snooze');
    });
    await waitFor(() => expect(snoozeIds()).toHaveLength(1));
    expect(store.history[0]).toMatchObject({ action: 'snoozed' });

    let snoozeNotification!: FakeNotification;
    await act(async () => {
      snoozeNotification = __fire(snoozeIds()[0]);
    });
    await act(async () => {
      __respond(snoozeNotification, 'dismiss');
    });

    await waitFor(() => expect(store.history[0]).toMatchObject({ action: 'dismissed' }));
    expect(snoozeIds()).toHaveLength(0);
  });

  it('ignores a stale notification for an alarm that was already handled', async () => {
    await mountApp();
    const notification = await createAndFire({ repeatDays: [1, 2, 3] });
    await act(async () => {
      await store.dismissRinging();
    });
    expect(store.ringing).toBeNull();

    // The user taps the old entry still sitting in the notification shade.
    await act(async () => {
      __respond(notification, DEFAULT_ACTION_IDENTIFIER);
    });

    expect(store.ringing).toBeNull();
  });

  it('records an unattended alarm as missed', async () => {
    await mountApp();
    await createAndFire();

    await act(async () => {
      await store.missRinging();
    });

    expect(store.ringing).toBeNull();
    expect(store.history[0]).toMatchObject({ action: 'missed' });
  });

  it('opens the ringing screen for a notification tapped while the app was closed', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ label: 'Cold start' }));
    });
    const identifier = alarmIds()[0];
    const notification = __fire(identifier);

    // Restart with the tap waiting to be delivered.
    __setColdStartResponse({ notification, actionIdentifier: DEFAULT_ACTION_IDENTIFIER });
    await mountApp();

    await waitFor(() => expect(store.ringing?.alarm.label).toBe('Cold start'));
  });
});

describe('surviving restarts and reboots', () => {
  it('restores alarms, settings and history after a restart', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ label: 'Persisted', hour: 5, repeatDays: [1, 2] }));
      await store.updateSettings({ themeMode: 'dark', defaultSnoozeMinutes: 15 });
    });

    await mountApp();

    expect(store.alarms).toHaveLength(1);
    expect(store.alarms[0]).toMatchObject({ label: 'Persisted', hour: 5, repeatDays: [1, 2] });
    expect(store.settings.themeMode).toBe('dark');
    expect(store.settings.defaultSnoozeMinutes).toBe(15);
  });

  it('does not duplicate notifications that the OS still holds', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ repeatDays: [1, 2, 3, 4, 5] }));
    });
    const before = scheduledIds().sort();
    const scheduleCallsBefore = fakeState.scheduleCalls;

    await mountApp();

    expect(scheduledIds().sort()).toEqual(before);
    expect(fakeState.scheduleCalls).toBe(scheduleCallsBefore);
  });

  it('rebuilds the schedule when the OS lost it (device reboot, app reinstall)', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ repeatDays: [1, 2, 3] }));
    });

    // Simulate an OS that dropped the pending alarms.
    fakeState.scheduled.clear();
    await mountApp();

    expect(alarmIds()).toHaveLength(OCCURRENCES_AHEAD);
  });

  it('logs an alarm that rang while the app was closed as missed and disables the one-shot', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ label: 'Missed me' }));
    });

    // Rewrite the persisted schedule so its occurrence is comfortably past,
    // exactly as it would be after the phone rang unattended.
    const stored = JSON.parse((await AsyncStorage.getItem('alarmclock:schedule')) ?? '[]');
    await AsyncStorage.setItem(
      'alarmclock:schedule',
      JSON.stringify(stored.map((item: { firesAt: number }) => ({ ...item, firesAt: Date.now() - 3_600_000 })))
    );

    await mountApp();

    expect(store.history[0]).toMatchObject({ action: 'missed', label: 'Missed me' });
    expect(store.alarms[0].enabled).toBe(false);
  });

  it('recovers from a corrupted alarm record without losing the good ones', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ label: 'Good' }));
    });

    const stored = JSON.parse((await AsyncStorage.getItem('alarmclock:alarms')) ?? '[]');
    await AsyncStorage.setItem(
      'alarmclock:alarms',
      JSON.stringify([{ nonsense: true }, ...stored, 'not-an-object'])
    );

    await mountApp();

    expect(store.alarms).toHaveLength(1);
    expect(store.alarms[0].label).toBe('Good');
  });

  it('starts clean when storage holds unparseable JSON', async () => {
    await AsyncStorage.setItem('alarmclock:alarms', '{oh no');
    await mountApp();

    expect(store.ready).toBe(true);
    expect(store.alarms).toEqual([]);
  });
});

describe('time and time-zone changes', () => {
  it('reschedules when the device time context changes', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ repeatDays: [1, 2, 3] }));
    });

    // Pretend the phone travelled: the stored context no longer matches.
    await AsyncStorage.setItem('alarmclock:timeContext', JSON.stringify('Pacific/Auckland@-780'));
    fakeState.scheduled.clear();

    await foregroundApp();

    expect(alarmIds()).toHaveLength(OCCURRENCES_AHEAD);
    const context = JSON.parse((await AsyncStorage.getItem('alarmclock:timeContext')) ?? '""');
    expect(context).not.toBe('Pacific/Auckland@-780');
  });

  it('tops the rolling window back up as occurrences are consumed', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ repeatDays: [0, 1, 2, 3, 4, 5, 6] }));
    });

    const soonest = alarmIds().sort(
      (a, b) =>
        (fakeState.scheduled.get(a)!.trigger.date as number) -
        (fakeState.scheduled.get(b)!.trigger.date as number)
    )[0];

    const notification = __fire(soonest);
    await act(async () => {
      __respond(notification, 'dismiss');
    });
    await foregroundApp();

    expect(alarmIds()).toHaveLength(OCCURRENCES_AHEAD);
  });
});

describe('settings', () => {
  it('persists a settings change immediately', async () => {
    await mountApp();

    await act(async () => {
      await store.updateSettings({ defaultVibrate: false, defaultSoundId: 'chimes' });
    });

    const stored = JSON.parse((await AsyncStorage.getItem('alarmclock:settings')) ?? '{}');
    expect(stored).toMatchObject({ defaultVibrate: false, defaultSoundId: 'chimes' });
  });

  it('rebuilds notification text when the clock format changes, keeping snoozes', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ hour: 18, minute: 5, repeatDays: [1, 2] }));
    });
    const alarm = store.alarms[0];

    // Put a snooze in flight.
    let notification!: FakeNotification;
    await act(async () => {
      notification = __fire(alarmIds()[0]);
    });
    await act(async () => {
      __respond(notification, 'snooze');
    });
    await waitFor(() => expect(snoozeIds()).toHaveLength(1));
    const snooze = snoozeIds()[0];

    await act(async () => {
      await store.updateSettings({ use24HourClock: true });
    });

    const body = [...fakeState.scheduled.values()].find((request) =>
      request.identifier.startsWith(ALARM_PREFIX)
    )!.content.body as string;
    expect(body).toContain('18:05');
    expect(body).not.toContain('PM');
    expect(snoozeIds()).toEqual([snooze]);
    expect(alarm.id).toBeDefined();
  });

  it('erases everything on request', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft({ repeatDays: [1] }));
      await store.updateSettings({ themeMode: 'dark' });
    });

    await act(async () => {
      await store.resetAllData();
    });

    expect(store.alarms).toEqual([]);
    expect(store.history).toEqual([]);
    expect(store.settings.themeMode).toBe('system');
    expect(scheduledIds()).toHaveLength(0);
    expect(await AsyncStorage.getItem('alarmclock:alarms')).toBeNull();
  });

  it('clears history without touching the alarms', async () => {
    await mountApp();
    await act(async () => {
      await store.addAlarm(draft());
    });
    await act(async () => {
      __fire(alarmIds()[0]);
    });
    await act(async () => {
      await store.dismissRinging();
    });
    expect(store.history).toHaveLength(1);

    await act(async () => {
      await store.clearHistory();
    });

    expect(store.history).toEqual([]);
    expect(store.alarms).toHaveLength(1);
  });
});

describe('error handling', () => {
  it('surfaces a scheduling failure instead of throwing', async () => {
    await mountApp();
    fakeState.scheduleShouldFail = true;

    await act(async () => {
      await store.addAlarm(draft());
    });

    await waitFor(() => expect(store.lastSyncError).toMatch(/could not be scheduled/i));
    expect(store.alarms).toHaveLength(1);
  });

  it('clears the error once scheduling succeeds again', async () => {
    await mountApp();
    fakeState.scheduleShouldFail = true;
    await act(async () => {
      await store.addAlarm(draft());
    });
    await waitFor(() => expect(store.lastSyncError).not.toBeNull());

    fakeState.scheduleShouldFail = false;
    await act(async () => {
      await store.resync();
    });

    await waitFor(() => expect(store.lastSyncError).toBeNull());
    expect(alarmIds()).toHaveLength(1);
  });
});
