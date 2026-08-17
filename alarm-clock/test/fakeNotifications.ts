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

type Listener<T> = (event: T) => void;

export interface FakeNotification {
  date: number;
  request: {
    identifier: string;
    content: { title?: string | null; body?: string | null; data?: unknown };
    trigger: Record<string, unknown>;
  };
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
  receivedListeners: new Set<Listener<FakeNotification>>(),
  responseListeners: new Set<Listener<unknown>>(),
  lastResponse: null as unknown,
  permissions: {
    granted: true,
    canAskAgain: true,
    status: 'granted' as string,
  },
  permissionRequests: 0,
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
  fakeState.receivedListeners.clear();
  fakeState.responseListeners.clear();
  fakeState.lastResponse = null;
  fakeState.permissions = { granted: true, canAskAgain: true, status: 'granted' };
  fakeState.permissionRequests = 0;
}

/**
 * Simulates the OS firing a scheduled notification: it leaves the pending
 * list, is presented in the shade, and running listeners are told about it.
 */
export function __fire(identifier: string): FakeNotification {
  const request = fakeState.scheduled.get(identifier);
  if (!request) {
    throw new Error(`No scheduled notification with identifier ${identifier}`);
  }
  fakeState.scheduled.delete(identifier);

  const notification: FakeNotification = { date: Date.now(), request };
  fakeState.presented.push({
    request: { identifier, content: request.content as { data?: unknown } },
  });
  fakeState.receivedListeners.forEach((listener) => listener(notification));
  return notification;
}

/** Simulates the user interacting with a delivered notification. */
export function __respond(
  notification: FakeNotification,
  actionIdentifier: string = DEFAULT_ACTION_IDENTIFIER
): void {
  const response = { notification, actionIdentifier };
  fakeState.lastResponse = response;
  fakeState.responseListeners.forEach((listener) => listener(response));
}

/**
 * Queues a response as if the app had been launched by a notification tap
 * while it was not running.
 */
export function __setColdStartResponse(response: unknown): void {
  fakeState.lastResponse = response;
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

export function addNotificationReceivedListener(listener: Listener<FakeNotification>) {
  fakeState.receivedListeners.add(listener);
  return {
    remove() {
      fakeState.receivedListeners.delete(listener);
    },
  };
}

export function addNotificationResponseReceivedListener(listener: Listener<unknown>) {
  fakeState.responseListeners.add(listener);
  return {
    remove() {
      fakeState.responseListeners.delete(listener);
    },
  };
}

export function getLastNotificationResponse() {
  return fakeState.lastResponse;
}

export function clearLastNotificationResponse(): void {
  fakeState.lastResponse = null;
}

export async function getPermissionsAsync() {
  return { ...fakeState.permissions, expires: 'never' };
}

export async function requestPermissionsAsync() {
  fakeState.permissionRequests += 1;
  return { ...fakeState.permissions, expires: 'never' };
}
