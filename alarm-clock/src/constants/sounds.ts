import type { AudioSource } from 'expo-audio';

import type { SoundId } from '../types/models';

export interface AlarmSound {
  id: SoundId;
  name: string;
  description: string;
  /**
   * File name as it exists in `assets/sounds` and, after the
   * `expo-notifications` config plugin runs, in `android/app/src/main/res/raw`.
   * This exact string is what an Android notification channel expects.
   */
  fileName: string | null;
  /** Bundled module used by the ringing screen for in-app playback. */
  module: AudioSource | null;
}

export const ALARM_SOUNDS: AlarmSound[] = [
  {
    id: 'classic_bell',
    name: 'Classic Bell',
    description: 'Struck twin-bell ring',
    fileName: 'classic_bell.wav',
    module: require('../../assets/sounds/classic_bell.wav'),
  },
  {
    id: 'digital_beep',
    name: 'Digital Beep',
    description: 'Sharp triple pulse',
    fileName: 'digital_beep.wav',
    module: require('../../assets/sounds/digital_beep.wav'),
  },
  {
    id: 'radar',
    name: 'Radar',
    description: 'Rising sonar sweeps',
    fileName: 'radar.wav',
    module: require('../../assets/sounds/radar.wav'),
  },
  {
    id: 'chimes',
    name: 'Chimes',
    description: 'Gentle four-note arpeggio',
    fileName: 'chimes.wav',
    module: require('../../assets/sounds/chimes.wav'),
  },
  {
    id: 'sunrise',
    name: 'Sunrise',
    description: 'Slow swelling pad',
    fileName: 'sunrise.wav',
    module: require('../../assets/sounds/sunrise.wav'),
  },
  {
    id: 'silent',
    name: 'Silent',
    description: 'Vibration only',
    fileName: null,
    module: null,
  },
];

const SOUND_BY_ID = new Map<SoundId, AlarmSound>(ALARM_SOUNDS.map((sound) => [sound.id, sound]));

export function getSound(id: SoundId): AlarmSound {
  return SOUND_BY_ID.get(id) ?? ALARM_SOUNDS[0];
}

export function getSoundName(id: SoundId): string {
  return getSound(id).name;
}

export function isKnownSoundId(id: string): id is SoundId {
  return SOUND_BY_ID.has(id as SoundId);
}
