import * as Notifications from 'expo-notifications';

import { logger } from '../../utils/logger';
import { refreshChannelCache } from './channels';
import { ensureNotificationCategory } from './scheduler';

export * from './channels';
export * from './permissions';
export * from './scheduler';

/** Payload the app attaches to every alarm notification it schedules. */
export interface AlarmNotificationPayload {
  alarmId: string;
  firesAt: number;
  kind: 'alarm' | 'snooze';
}

/**
 * Foreground presentation.
 *
 * When the app is open the in-app ringing screen owns the experience — it
 * plays the tone on a loop, vibrates and offers full-size controls — so the
 * banner and the system sound are suppressed to avoid a double ring. The
 * notification is still added to the shade so the alarm leaves a trace.
 */
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const isAlarm = parseAlarmPayload(notification.request.content.data) !== null;
    return {
      shouldShowBanner: !isAlarm,
      shouldShowList: true,
      shouldPlaySound: !isAlarm,
      shouldSetBadge: false,
    };
  },
  handleError: (identifier, error) => {
    logger.error('notifications', `Handler failed for ${identifier}: ${String(error)}`);
  },
});

export function parseAlarmPayload(data: unknown): AlarmNotificationPayload | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const record = data as Record<string, unknown>;
  if (record.type !== 'alarm' || typeof record.alarmId !== 'string') {
    return null;
  }
  return {
    alarmId: record.alarmId,
    firesAt: typeof record.firesAt === 'number' ? record.firesAt : Date.now(),
    kind: record.kind === 'snooze' ? 'snooze' : 'alarm',
  };
}

/** One-time setup that must run before anything is scheduled. */
export async function initialiseNotifications(): Promise<void> {
  await Promise.all([ensureNotificationCategory(), refreshChannelCache()]);
}
