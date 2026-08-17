const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/**
 * Splits the two exact-alarm permissions the way Google Play expects from an
 * alarm clock app.
 *
 * * `USE_EXACT_ALARM` (API 33+) is granted at install time and is restricted to
 *   apps whose core function is alarms or calendar events — which this is.
 * * `SCHEDULE_EXACT_ALARM` is only needed on API 31–32, where `USE_EXACT_ALARM`
 *   does not exist yet. Declaring it without a `maxSdkVersion` makes Play treat
 *   the app as requesting the user-revocable permission on modern devices too,
 *   which triggers an extra policy declaration and shows an "Alarms & reminders"
 *   toggle the app does not actually depend on.
 *
 * `app.json` cannot express `android:maxSdkVersion`, hence this plugin.
 */
const SCHEDULE_EXACT_ALARM = 'android.permission.SCHEDULE_EXACT_ALARM';
const LEGACY_MAX_SDK = '32';

module.exports = function withExactAlarmPermissions(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];

    const permission = manifest['uses-permission'].find(
      (entry) => entry.$?.['android:name'] === SCHEDULE_EXACT_ALARM
    );

    if (permission) {
      permission.$['android:maxSdkVersion'] = LEGACY_MAX_SDK;
    } else {
      AndroidConfig.Manifest.ensurePermission(manifest, SCHEDULE_EXACT_ALARM);
      const added = manifest['uses-permission'].find(
        (entry) => entry.$?.['android:name'] === SCHEDULE_EXACT_ALARM
      );
      if (added) {
        added.$['android:maxSdkVersion'] = LEGACY_MAX_SDK;
      }
    }

    return modConfig;
  });
};
