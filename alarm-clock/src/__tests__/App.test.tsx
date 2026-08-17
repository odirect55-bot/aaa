import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Alert } from 'react-native';

jest.mock('expo-notifications', () => require('../../test/fakeNotifications'));
jest.mock('expo-audio', () => require('../../test/fakeAudio'));

import App from '../../App';
import { __fire, __reset, fakeState } from '../../test/fakeNotifications';
import { fakeAudioState, __resetAudio } from '../../test/fakeAudio';
import { ALARM_PREFIX, SNOOZE_PREFIX } from '../services/notifications/scheduler';

/**
 * Smoke tests that mount the whole app — providers, navigation and screens —
 * and drive it the way a user would. These catch render-time crashes and
 * wiring mistakes that store-level tests cannot see.
 *
 * Note: in React Native Testing Library v14 `render` and `fireEvent` are async
 * and already wrapped in `act`, so they are awaited directly. Only updates that
 * originate outside React (a notification arriving, an Alert button firing)
 * need an explicit `act`.
 */

function idsWithPrefix(prefix: string): string[] {
  return [...fakeState.scheduled.keys()].filter((id) => id.startsWith(prefix));
}

const alarmIds = () => idsWithPrefix(ALARM_PREFIX);
const snoozeIds = () => idsWithPrefix(SNOOZE_PREFIX);

beforeEach(async () => {
  __reset();
  __resetAudio();
  await AsyncStorage.clear();
});

async function launch() {
  await render(<App />);
  await screen.findByText('Alarms');
}

/** Creates one alarm with the editor's defaults. */
async function createAlarm() {
  await fireEvent.press(screen.getByText('Create your first alarm'));
  await fireEvent.press(await screen.findByLabelText('Create alarm'));
  await waitFor(() => expect(alarmIds()).toHaveLength(1));
}

describe('app shell', () => {
  it('starts on the alarm list with an empty state', async () => {
    await launch();

    expect(screen.getByText('No alarms yet')).toBeTruthy();
    expect(screen.getByLabelText('Add alarm')).toBeTruthy();
    expect(screen.getByLabelText('Settings')).toBeTruthy();
  });

  it('creates an alarm through the editor and shows it in the list', async () => {
    await launch();
    await createAlarm();

    await waitFor(() => expect(screen.queryByText('No alarms yet')).toBeNull());
    expect(await screen.findByText(/Once/)).toBeTruthy();
  });

  it('opens settings', async () => {
    await launch();
    await fireEvent.press(screen.getByLabelText('Settings'));

    expect(await screen.findByText('DEFAULTS FOR NEW ALARMS')).toBeTruthy();
    expect(screen.getByText('Clock format')).toBeTruthy();
    expect(screen.getByLabelText('Erase all data')).toBeTruthy();
  });
});

describe('managing alarms from the list', () => {
  it('turns an alarm off and on again with the switch', async () => {
    await launch();
    await createAlarm();

    // The host component exposes `onChange`, which is what a real tap fires.
    await fireEvent(screen.getByLabelText(/^Enable Alarm at/), 'change', {
      nativeEvent: { value: false },
    });
    await waitFor(() => expect(alarmIds()).toHaveLength(0));

    await fireEvent(screen.getByLabelText(/^Enable Alarm at/), 'change', {
      nativeEvent: { value: true },
    });
    await waitFor(() => expect(alarmIds()).toHaveLength(1));
  });

  it('deletes an alarm once the confirmation is accepted', async () => {
    await launch();
    await createAlarm();

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await fireEvent(screen.getByLabelText(/^Alarm at .*Once$/), 'longPress');

    const buttons = alertSpy.mock.calls[0][2];
    const destructive = buttons?.find((button) => button.style === 'destructive');
    expect(destructive).toBeDefined();

    await act(async () => {
      destructive?.onPress?.();
    });

    await waitFor(() => expect(screen.queryByText('No alarms yet')).not.toBeNull());
    await waitFor(() => expect(alarmIds()).toHaveLength(0));
    alertSpy.mockRestore();
  });

  it('opens an existing alarm in the editor', async () => {
    await launch();
    await createAlarm();

    await fireEvent.press(screen.getByLabelText(/^Alarm at .*Once$/));

    expect(await screen.findByLabelText('Save changes')).toBeTruthy();
    expect(screen.getByLabelText('Delete alarm')).toBeTruthy();
    expect(screen.getByLabelText('Alarm label')).toBeTruthy();
  });
});

describe('notification permission', () => {
  it('warns on the alarm list when notifications are refused', async () => {
    fakeState.permissions = { granted: false, canAskAgain: true, status: 'undetermined' };
    await launch();

    expect(await screen.findByText('Notifications are off')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Allow notifications'));
    await waitFor(() => expect(fakeState.permissionRequests).toBeGreaterThan(0));
  });

  it('offers system settings when the user cannot be asked again', async () => {
    fakeState.permissions = { granted: false, canAskAgain: false, status: 'denied' };
    await launch();

    expect(await screen.findByLabelText('Open settings')).toBeTruthy();
  });
});

describe('ringing screen', () => {
  it('takes over the screen when an alarm fires, and dismisses back to the list', async () => {
    await launch();
    await createAlarm();

    await act(async () => {
      __fire(alarmIds()[0]);
    });

    expect(await screen.findByText('ALARM')).toBeTruthy();
    expect(screen.getByLabelText(/Snooze \d+ min/)).toBeTruthy();

    // It really is ringing: a looping player was started.
    expect(fakeAudioState.players).toHaveLength(1);
    expect(fakeAudioState.players[0].loop).toBe(true);
    expect(fakeAudioState.players[0].playing).toBe(true);

    await fireEvent.press(screen.getByLabelText('Dismiss'));

    await waitFor(() => expect(screen.queryByText('ALARM')).toBeNull());
    // Silence: the player was released when the screen went away.
    expect(fakeAudioState.players[0].playing).toBe(false);
    expect(fakeAudioState.players[0].released).toBe(true);
  });

  it('snoozes from the ringing screen', async () => {
    await launch();
    await createAlarm();

    await act(async () => {
      __fire(alarmIds()[0]);
    });
    await fireEvent.press(await screen.findByLabelText(/Snooze \d+ min/));

    await waitFor(() => expect(screen.queryByText('ALARM')).toBeNull());
    await waitFor(() => expect(snoozeIds()).toHaveLength(1));
    expect(fakeAudioState.players[0].released).toBe(true);
  });
});
