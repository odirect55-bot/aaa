import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Vibration } from 'react-native';

import { getSound } from '../constants/sounds';
import type { SoundId } from '../types/models';
import { logger } from '../utils/logger';

/**
 * Sound and vibration for the in-app ringing screen and for previewing tones
 * in the pickers.
 *
 * Kept outside React so a re-render (or a fast unmount/remount while a screen
 * animates in) can never leave a second looping player running. The two uses
 * are tracked separately: stopping a preview must never silence an alarm that
 * started ringing while a picker was open.
 */

const VIBRATION_PATTERN = [0, 700, 400, 700, 400, 700];

/** How long a tone plays when auditioned from a picker. */
const PREVIEW_MS = 5_000;

type Mode = 'alarm' | 'preview';

let player: AudioPlayer | null = null;
let mode: Mode | null = null;
let vibrating = false;
let previewTimeout: ReturnType<typeof setTimeout> | null = null;
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

function releasePlayer(): void {
  if (previewTimeout) {
    clearTimeout(previewTimeout);
    previewTimeout = null;
  }
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch (error) {
      logger.warn('audio', `Could not release player: ${String(error)}`);
    }
    player = null;
  }
  mode = null;
}

function stopVibration(): void {
  if (vibrating) {
    Vibration.cancel();
    vibrating = false;
  }
}

/** Starts (or restarts) the ringing tone and vibration. Safe to call twice. */
export async function startRinging(soundId: SoundId, vibrate: boolean): Promise<void> {
  releasePlayer();
  stopVibration();
  await configureAudioMode();

  const sound = getSound(soundId);
  if (sound.module) {
    try {
      player = createAudioPlayer(sound.module);
      mode = 'alarm';
      player.loop = true;
      player.volume = 1;
      player.play();
    } catch (error) {
      logger.error('audio', error);
      releasePlayer();
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

/** Stops everything, whichever mode is active. Safe to call when idle. */
export async function stopRinging(): Promise<void> {
  releasePlayer();
  stopVibration();
}

/**
 * Plays a short audition of a tone for the sound pickers. It stops itself
 * after {@link PREVIEW_MS} so the full 15-second tone does not keep playing
 * after the sheet is closed.
 */
export async function previewSound(soundId: SoundId): Promise<void> {
  // Never interrupt a real alarm to audition a tone.
  if (mode === 'alarm') {
    return;
  }
  releasePlayer();

  const sound = getSound(soundId);
  if (!sound.module) {
    // "Silent" has nothing to play; show what it does instead.
    Vibration.vibrate(400);
    return;
  }

  await configureAudioMode();
  try {
    player = createAudioPlayer(sound.module);
    mode = 'preview';
    player.loop = false;
    player.volume = 1;
    player.play();
    previewTimeout = setTimeout(() => {
      if (mode === 'preview') {
        releasePlayer();
      }
    }, PREVIEW_MS);
  } catch (error) {
    logger.error('audio', error);
    releasePlayer();
  }
}

/**
 * Stops a preview and nothing else — used when a picker closes, where
 * silencing a concurrently ringing alarm would be a bug.
 */
export function stopPreview(): void {
  if (mode === 'preview') {
    releasePlayer();
  }
}
