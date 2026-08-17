import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform, Vibration } from 'react-native';

import { getSound } from '../constants/sounds';
import type { SoundId } from '../types/models';
import { logger } from '../utils/logger';

/**
 * Sound and vibration for the in-app ringing screen.
 *
 * Kept outside React so a re-render (or a fast unmount/remount while the
 * screen animates in) can never leave a second looping player running.
 */

const VIBRATION_PATTERN = [0, 700, 400, 700, 400, 700];

let player: AudioPlayer | null = null;
let vibrating = false;
let audioModeConfigured = false;

async function configureAudioMode(): Promise<void> {
  if (audioModeConfigured) {
    return;
  }
  try {
    await setAudioModeAsync({
      // An alarm has to be heard even when the phone is on silent.
      playsInSilentMode: true,
      // Take exclusive focus so music or a podcast pauses while it rings.
      interruptionMode: 'doNotMix',
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
    audioModeConfigured = true;
  } catch (error) {
    logger.error('audio', error);
  }
}

/** Starts (or restarts) the ringing tone and vibration. Safe to call twice. */
export async function startRinging(soundId: SoundId, vibrate: boolean): Promise<void> {
  await stopRinging();
  await configureAudioMode();

  const sound = getSound(soundId);
  if (sound.module) {
    try {
      player = createAudioPlayer(sound.module);
      player.loop = true;
      player.volume = 1;
      player.play();
    } catch (error) {
      logger.error('audio', error);
      player = null;
    }
  }

  if (vibrate) {
    try {
      // `true` repeats the pattern until cancelled.
      Vibration.vibrate(VIBRATION_PATTERN, true);
      vibrating = true;
    } catch (error) {
      logger.error('audio', error);
    }
  }

  if (!sound.module && !vibrate) {
    logger.warn('audio', 'Alarm is ringing with neither sound nor vibration');
  }
}

/** Stops everything the ringing screen started. Safe to call when idle. */
export async function stopRinging(): Promise<void> {
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch (error) {
      logger.warn('audio', `Could not release player: ${String(error)}`);
    }
    player = null;
  }

  if (vibrating) {
    Vibration.cancel();
    vibrating = false;
  }
}

/** Short tactile confirmation used when previewing a tone in the picker. */
export async function previewSound(soundId: SoundId): Promise<void> {
  const sound = getSound(soundId);
  await stopRinging();
  if (!sound.module) {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(400);
    }
    return;
  }
  await configureAudioMode();
  try {
    player = createAudioPlayer(sound.module);
    player.loop = false;
    player.play();
  } catch (error) {
    logger.error('audio', error);
  }
}
