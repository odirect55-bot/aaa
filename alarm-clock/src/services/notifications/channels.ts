import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getSound } from '../../constants/sounds';
import type { SoundId } from '../../types/models';
import { logger } from '../../utils/logger';

/**
 * Android notification channels.
 *
 * On Android 8+ the sound and vibration of a notification come from its
 * channel, and a channel is immutable once created. A single "Alarms" channel
 * therefore cannot honour a per-alarm sound choice — so the app creates one
 * channel per (sound, vibration) combination and picks the right one when
 * scheduling. Channels are created lazily and cached.
 *
 * The channels use `usage: ALARM` audio attributes with `enforceAudibility`,
 * which is what makes the tone play through the alarm stream at alarm volume
 * rather than the (often muted) notification stream.
 */

export const CHANNEL_GROUP_ID = 'alarms';

/** Bumping the prefix creates fresh channels if their configuration changes. */
const CHANNEL_PREFIX = 'alarm.v1';

const VIBRATION_PATTERN = [0, 700, 400, 700, 400, 700];

const knownChannels = new Set<string>();
let groupCreated = false;

export function channelIdFor(soundId: SoundId, vibrate: boolean): string {
  return `${CHANNEL_PREFIX}.${soundId}.${vibrate ? 'vibrate' : 'still'}`;
}

/** `true` when this platform routes notifications through channels. */
export function usesChannels(): boolean {
  return Platform.OS === 'android';
}

export async function ensureChannelGroup(): Promise<void> {
  if (!usesChannels() || groupCreated) {
    return;
  }
  try {
    await Notifications.setNotificationChannelGroupAsync(CHANNEL_GROUP_ID, {
      name: 'Alarms',
      description: 'Channels used to ring your alarms.',
    });
    groupCreated = true;
  } catch (error) {
    logger.error('channels', error);
  }
}

/**
 * Creates (once) and returns the channel matching this sound/vibration pair.
 * Returns `undefined` on platforms without channels so callers can spread the
 * result into a trigger without branching.
 */
export async function ensureAlarmChannel(
  soundId: SoundId,
  vibrate: boolean
): Promise<string | undefined> {
  if (!usesChannels()) {
    return undefined;
  }

  const channelId = channelIdFor(soundId, vibrate);
  if (knownChannels.has(channelId)) {
    return channelId;
  }

  const sound = getSound(soundId);

  try {
    await ensureChannelGroup();
    await Notifications.setNotificationChannelAsync(channelId, {
      name: `${sound.name}${vibrate ? ' + vibration' : ''}`,
      description: 'Rings your alarms at the scheduled time.',
      groupId: CHANNEL_GROUP_ID,
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      // `null` means "no sound"; a file name resolves against res/raw, which
      // the expo-notifications config plugin fills from assets/sounds.
      sound: sound.fileName,
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
      enableVibrate: vibrate,
      vibrationPattern: vibrate ? VIBRATION_PATTERN : undefined,
      enableLights: true,
      lightColor: '#6C5CE7',
      showBadge: false,
      // Only takes effect if the user grants Do Not Disturb access; harmless
      // otherwise, and exactly what an alarm should ask for.
      bypassDnd: true,
    });
    knownChannels.add(channelId);
    return channelId;
  } catch (error) {
    logger.error('channels', error);
    // Fall back to the default channel rather than dropping the alarm.
    return undefined;
  }
}

/**
 * Rebuilds the cache from what Android actually has.
 *
 * The cache is replaced rather than extended on purpose: a user can delete a
 * channel from the system notification settings at any time, and an alarm that
 * silently fell back to the default channel would ring with the wrong sound.
 * Refreshing before each scheduling pass means the channel is simply recreated.
 */
export async function refreshChannelCache(): Promise<void> {
  if (!usesChannels()) {
    return;
  }
  try {
    const channels = await Notifications.getNotificationChannelsAsync();
    knownChannels.clear();
    channels?.forEach((channel) => {
      if (channel.id.startsWith(CHANNEL_PREFIX)) {
        knownChannels.add(channel.id);
      }
    });
  } catch (error) {
    logger.error('channels', error);
  }
}

/**
 * Removes channels the user can no longer reach through any alarm, so the
 * system notification settings screen does not fill up with dead entries.
 */
export async function pruneUnusedChannels(inUse: Set<string>): Promise<void> {
  if (!usesChannels()) {
    return;
  }
  try {
    const channels = await Notifications.getNotificationChannelsAsync();
    for (const channel of channels ?? []) {
      if (channel.id.startsWith(CHANNEL_PREFIX) && !inUse.has(channel.id)) {
        await Notifications.deleteNotificationChannelAsync(channel.id);
        knownChannels.delete(channel.id);
      }
    }
  } catch (error) {
    logger.error('channels', error);
  }
}
