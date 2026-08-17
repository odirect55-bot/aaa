/**
 * A stand-in for the native notification service.
 *
 * It behaves like the OS scheduler in the ways the app depends on: identifiers
 * are unique keys (scheduling the same identifier twice replaces it), the
 * pending list can be read back, and cancelling an unknown identifier is a
 * no-op rather than an error. Tests use it to verify that repeated syncs never
 * accumulate duplicate alarms.
 */

interface ScheduledRequest {
  identifier: string;
  content: Record<string, unknown>;
  trigger: Record<string, unknown>;
}

export const fakeState = {
  scheduled: new Map<string, ScheduledRequest>(),
  channels: new Map<string, Record<string, unknown>>(),
  channelGroups: new Map<string, Record<string, unknown>>(),
  categories: new Map<string, unknown>(),
  presented: [] as { request: { identifier: string; content: { data?: unknown } } }[],
  scheduleCalls: 0,
  cancelCalls: 0,
  scheduleShouldFail: false,
};

export function __reset(): void {
  fakeState.scheduled.clear();
  fakeState.channels.clear();
  fakeState.channelGroups.clear();
  fakeState.categories.clear();
  fakeState.presented = [];
  fakeState.scheduleCalls = 0;
  fakeState.cancelCalls = 0;
  fakeState.scheduleShouldFail = false;
}

export const SchedulableTriggerInputTypes = {
  CALENDAR: 'calendar',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  DATE: 'date',
  TIME_INTERVAL: 'timeInterval',
} as const;

export const AndroidNotificationPriority = {
  MIN: 'min',
  LOW: 'low',
  DEFAULT: 'default',
  HIGH: 'high',
  MAX: 'max',
} as const;

export const AndroidImportance = {
  UNKNOWN: 0,
  UNSPECIFIED: 1,
  NONE: 2,
  MIN: 3,
  LOW: 4,
  DEFAULT: 5,
  HIGH: 6,
  MAX: 7,
} as const;

export const AndroidNotificationVisibility = { UNKNOWN: 0, PUBLIC: 1, PRIVATE: 2, SECRET: 3 } as const;
export const AndroidAudioContentType = {
  UNKNOWN: 0,
  SPEECH: 1,
  MUSIC: 2,
  MOVIE: 3,
  SONIFICATION: 4,
} as const;
export const AndroidAudioUsage = { UNKNOWN: 0, MEDIA: 1, ALARM: 4, NOTIFICATION: 5 } as const;
export const IosAuthorizationStatus = {
  NOT_DETERMINED: 0,
  DENIED: 1,
  AUTHORIZED: 2,
  PROVISIONAL: 3,
  EPHEMERAL: 4,
} as const;

export const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';

export async function scheduleNotificationAsync(request: ScheduledRequest): Promise<string> {
  fakeState.scheduleCalls += 1;
  if (fakeState.scheduleShouldFail) {
    throw new Error('Simulated scheduling failure');
  }
  const identifier = request.identifier ?? `auto_${fakeState.scheduled.size}`;
  fakeState.scheduled.set(identifier, { ...request, identifier });
  return identifier;
}

export async function getAllScheduledNotificationsAsync(): Promise<ScheduledRequest[]> {
  return [...fakeState.scheduled.values()];
}

export async function cancelScheduledNotificationAsync(identifier: string): Promise<void> {
  fakeState.cancelCalls += 1;
  fakeState.scheduled.delete(identifier);
}

export async function cancelAllScheduledNotificationsAsync(): Promise<void> {
  fakeState.scheduled.clear();
}

export async function setNotificationChannelAsync(
  channelId: string,
  config: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const channel = { id: channelId, ...config };
  fakeState.channels.set(channelId, channel);
  return channel;
}

export async function getNotificationChannelsAsync(): Promise<Record<string, unknown>[]> {
  return [...fakeState.channels.values()];
}

export async function deleteNotificationChannelAsync(channelId: string): Promise<void> {
  fakeState.channels.delete(channelId);
}

export async function setNotificationChannelGroupAsync(
  groupId: string,
  config: Record<string, unknown>
): Promise<void> {
  fakeState.channelGroups.set(groupId, config);
}

export async function setNotificationCategoryAsync(
  identifier: string,
  actions: unknown
): Promise<void> {
  fakeState.categories.set(identifier, actions);
}

export async function getPresentedNotificationsAsync() {
  return fakeState.presented;
}

export async function dismissNotificationAsync(identifier: string): Promise<void> {
  fakeState.presented = fakeState.presented.filter(
    (notification) => notification.request.identifier !== identifier
  );
}

export function setNotificationHandler(): void {}
export function addNotificationReceivedListener() {
  return { remove() {} };
}
export function addNotificationResponseReceivedListener() {
  return { remove() {} };
}
export function getLastNotificationResponse() {
  return null;
}
export function clearLastNotificationResponse(): void {}
export async function getPermissionsAsync() {
  return { granted: true, canAskAgain: true, status: 'granted', expires: 'never' };
}
export async function requestPermissionsAsync() {
  return { granted: true, canAskAgain: true, status: 'granted', expires: 'never' };
}
