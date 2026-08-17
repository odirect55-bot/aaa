import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { logger } from '../../utils/logger';

export interface PermissionState {
  granted: boolean;
  canAskAgain: boolean;
  status: Notifications.NotificationPermissionsStatus['status'] | 'unknown';
}

const UNKNOWN: PermissionState = { granted: false, canAskAgain: true, status: 'unknown' };

function toState(status: Notifications.NotificationPermissionsStatus): PermissionState {
  return {
    // On iOS a provisional authorisation still allows delivery.
    granted:
      status.granted ||
      status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
    canAskAgain: status.canAskAgain,
    status: status.status,
  };
}

export async function getPermissionState(): Promise<PermissionState> {
  try {
    return toState(await Notifications.getPermissionsAsync());
  } catch (error) {
    logger.error('permissions', error);
    return UNKNOWN;
  }
}

/**
 * Asks for notification permission. On Android 13+ this shows the
 * POST_NOTIFICATIONS dialog; on older Android versions it resolves as granted
 * without any UI. Once the user has denied it, Android never shows the dialog
 * again, which is why the caller gets `canAskAgain` back and can offer a
 * shortcut into system settings instead.
 */
export async function requestPermission(): Promise<PermissionState> {
  try {
    return toState(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false, allowCriticalAlerts: true },
      })
    );
  } catch (error) {
    logger.error('permissions', error);
    return UNKNOWN;
  }
}

/** Opens this app's entry in the OS settings app. */
export async function openAppSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch (error) {
    logger.error('permissions', error);
  }
}

/**
 * Android 12+ gates exact alarms behind "Alarms & reminders". The app declares
 * `USE_EXACT_ALARM`, so the capability is granted at install time on Play
 * builds, but a sideloaded or downgraded install can still land on
 * `SCHEDULE_EXACT_ALARM`, where the user has to allow it manually.
 */
export async function openExactAlarmSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    await Linking.sendIntent('android.settings.REQUEST_SCHEDULE_EXACT_ALARM');
  } catch {
    // Not every OEM exposes that screen; the app settings page always works.
    await openAppSettings();
  }
}

/**
 * Aggressive battery optimisation is the most common reason a scheduled alarm
 * is delayed on Android, so the Settings screen links straight to the screen
 * where the user can exempt this app.
 */
export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    await Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
  } catch {
    await openAppSettings();
  }
}
