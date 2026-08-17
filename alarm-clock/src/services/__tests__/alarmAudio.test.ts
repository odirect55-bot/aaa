import { Vibration } from 'react-native';

jest.mock('expo-audio', () => require('../../../test/fakeAudio'));

import { __resetAudio, fakeAudioState } from '../../../test/fakeAudio';
import { previewSound, startRinging, stopPreview, stopRinging } from '../alarmAudio';

/**
 * The ringing tone and the picker's preview share one player, so these tests
 * pin down the rule that matters: a preview may never silence a live alarm.
 */

describe('alarmAudio', () => {
  beforeEach(() => {
    __resetAudio();
    jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
    jest.spyOn(Vibration, 'cancel').mockImplementation(() => {});
  });

  afterEach(async () => {
    await stopRinging();
    jest.restoreAllMocks();
  });

  it('loops the tone and vibrates when an alarm rings', async () => {
    await startRinging('classic_bell', true);

    expect(fakeAudioState.players).toHaveLength(1);
    expect(fakeAudioState.players[0]).toMatchObject({ loop: true, playing: true, volume: 1 });
    expect(Vibration.vibrate).toHaveBeenCalledWith(expect.any(Array), true);
    // Alarms must be audible with the phone on silent.
    expect(fakeAudioState.audioMode).toMatchObject({
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    });
  });

  it('vibrates without a player for the silent tone', async () => {
    await startRinging('silent', true);

    expect(fakeAudioState.players).toHaveLength(0);
    expect(Vibration.vibrate).toHaveBeenCalled();
  });

  it('releases the player and stops vibrating when the alarm ends', async () => {
    await startRinging('radar', true);
    await stopRinging();

    expect(fakeAudioState.players[0].playing).toBe(false);
    expect(fakeAudioState.players[0].released).toBe(true);
    expect(Vibration.cancel).toHaveBeenCalled();
  });

  it('never starts a second player when called twice', async () => {
    await startRinging('radar', false);
    await startRinging('chimes', false);

    expect(fakeAudioState.players).toHaveLength(2);
    expect(fakeAudioState.players[0].released).toBe(true);
    expect(fakeAudioState.players[1].playing).toBe(true);
  });

  it('refuses to preview a tone over a ringing alarm', async () => {
    await startRinging('classic_bell', false);
    await previewSound('radar');

    expect(fakeAudioState.players).toHaveLength(1);
    expect(fakeAudioState.players[0].playing).toBe(true);
    expect(fakeAudioState.players[0].loop).toBe(true);
  });

  it('leaves a ringing alarm alone when a picker closes', async () => {
    await startRinging('classic_bell', true);
    const cancelsBefore = (Vibration.cancel as jest.Mock).mock.calls.length;

    stopPreview();

    expect(fakeAudioState.players[0].playing).toBe(true);
    expect(fakeAudioState.players[0].released).toBe(false);
    // Closing a picker must not cancel the alarm's vibration.
    expect((Vibration.cancel as jest.Mock).mock.calls.length).toBe(cancelsBefore);
  });

  it('plays a preview once and stops it on request', async () => {
    await previewSound('chimes');

    expect(fakeAudioState.players).toHaveLength(1);
    expect(fakeAudioState.players[0].loop).toBe(false);
    expect(fakeAudioState.players[0].playing).toBe(true);

    stopPreview();
    expect(fakeAudioState.players[0].released).toBe(true);
  });

  it('stops a preview by itself after a few seconds', async () => {
    jest.useFakeTimers();
    try {
      await previewSound('sunrise');
      expect(fakeAudioState.players[0].playing).toBe(true);

      jest.advanceTimersByTime(10_000);
      expect(fakeAudioState.players[0].released).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
