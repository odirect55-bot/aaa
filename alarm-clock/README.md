# Alarm Clock

An alarm clock for Android (and iOS) built with React Native, Expo SDK 57 and
TypeScript. Alarms are handed to the operating system as exact, wake-up
notifications, so they ring when the app is backgrounded, swiped away or the
phone has been rebooted — nothing about the ringing depends on the app being
alive.

---

## Running it

Custom alarm tones are shipped as Android `res/raw` resources by the
`expo-notifications` config plugin, and notification channels with alarm audio
attributes are not available in Expo Go. **This app needs a development build**,
not Expo Go:

```bash
cd alarm-clock
npm install
npx expo run:android      # builds and installs a dev build on a device/emulator
```

You need Android Studio (or the Android SDK plus a JDK 17+) and a device or
emulator with API 24 or newer. Once installed, `npx expo start` attaches to the
running dev build for fast refresh.

On first launch the app asks for notification permission the moment you save
your first alarm. On Android 13+ that permission is mandatory — nothing rings
without it, and the alarm list says so if it is missing.

```bash
npm test          # 131 unit, integration and UI tests
npm run typecheck # tsc --noEmit
```

## How the alarms actually work

### Scheduling

`src/services/notifications/scheduler.ts` is the core. Each alarm is expanded
into concrete future instants and each instant becomes one `DATE`-triggered
notification:

* **Deterministic identifiers.** A notification is named
  `alarm.<alarmId>.<epochMillis>`. Scheduling the same occurrence twice replaces
  it instead of creating a duplicate, and the app can diff what *should* be
  scheduled against what the OS reports via
  `getAllScheduledNotificationsAsync()`. That diff — not local bookkeeping — is
  the source of truth, so the schedule repairs itself after a crash, an OS
  cleanup or a restore.
* **A rolling window.** A repeating alarm keeps its next 8 occurrences
  scheduled (`OCCURRENCES_AHEAD`); a one-shot alarm keeps exactly one. Every
  time the app comes to the foreground the window is topped back up, so an app
  that is never opened again still rings for at least the next eight
  occurrences.
* **Wall-clock arithmetic.** Occurrences are built with the local `Date`
  constructor rather than by adding 24 hours, so a 07:00 alarm stays at 07:00
  across a daylight-saving change (the tests assert the 23-hour and 25-hour
  days). Time-zone changes, manual clock changes and DST transitions are
  detected by comparing a stored "time context" (IANA zone + UTC offset) on
  every foreground and once a minute while the app is open; a change triggers a
  full resync.
* **Exact delivery.** `expo-notifications` uses
  `AlarmManagerCompat.setExactAndAllowWhileIdle` when the app may schedule
  exact alarms, which is why the manifest declares `USE_EXACT_ALARM` and
  `SCHEDULE_EXACT_ALARM`. Settings links to the "Alarms & reminders" and
  battery-optimisation screens for the cases where the user has to intervene.
* **Reboot.** `expo-notifications` registers a `BOOT_COMPLETED` receiver that
  re-registers every persisted notification with `AlarmManager`, so alarms
  survive a restart. (Android's own limits still apply: a *force-stopped* app
  is not restarted by the system until the user opens it again.)

### Sound and vibration

On Android 8+, sound and vibration belong to the notification channel, and a
channel is immutable once created. A single "Alarms" channel therefore cannot
honour a per-alarm tone, so the app creates **one channel per (sound,
vibration) pair** — `alarm.v1.<sound>.<vibrate|still>` — with
`AndroidImportance.MAX` and `usage: ALARM` audio attributes with
`enforceAudibility`, so the tone plays on the alarm stream at alarm volume
instead of the (often silenced) notification stream. Unused channels are pruned
on every sync, and the channel cache is rebuilt from the OS each time, so a
channel the user deleted in system settings is recreated rather than silently
falling back to the default.

The five bundled tones are synthesised from scratch by
`scripts/generate-sounds.py` (stdlib only) as loop-safe 15-second WAVs; the app
icon, adaptive icon and notification icon come from `scripts/generate-icons.py`.
Run `npm run generate:assets` to rebuild them.

### While it rings

* **App closed or backgrounded** — Android presents the notification on the
  alarm channel, full screen-wake, with **Snooze** and **Dismiss** buttons. Both
  buttons foreground the app on purpose: acting on an alarm has to run
  JavaScript (schedule the snooze, write history, silence the tone), and Android
  does not deliver background actions to a killed app.
* **App open** — the foreground handler suppresses the system banner and sound,
  and the in-app ringing screen takes over: looping tone through `expo-audio`
  (configured to play in silent mode and to take exclusive audio focus), a
  repeating vibration pattern, the screen kept awake, hardware back blocked, and
  huge Snooze/Dismiss targets. It stops by itself after the configured window
  and records the alarm as missed.
* **Both at once** — if the alarm arrives while the app is in the background,
  the ringing screen mounts silently and only starts its own tone when the app
  is actually brought forward, so it never plays on top of the notification
  sound. An alarm with snooze switched off gets a Dismiss-only notification, and
  a snooze request on it degrades to a dismissal rather than borrowing the
  global default.

### After the fact

Every occurrence the app scheduled is persisted. On the next launch,
`reconcilePastOccurrences` compares those records against the history log: an
occurrence more than two minutes old with no dismissal or snooze is recorded as
**missed**, and a one-shot alarm whose time has passed switches itself off — the
behaviour you get whether or not the app was running when it rang.

## Architecture

```
alarm-clock/
├── App.tsx                      providers + navigation root
├── app.json                     permissions, notification plugin, sounds
├── scripts/                     asset generators (sounds, icons)
└── src/
    ├── types/models.ts          Alarm, Settings, HistoryEntry, ScheduledOccurrence
    ├── constants/sounds.ts      bundled tone registry
    ├── utils/                   time maths, validation, ids, logging
    ├── services/
    │   ├── storage.ts           versioned AsyncStorage repository
    │   ├── alarmAudio.ts        ringing tone + vibration (outside React)
    │   └── notifications/       channels, permissions, scheduler
    ├── state/AlarmStore.tsx     single store: state, persistence, sync, listeners
    ├── theme/                   light & dark palettes, tokens, provider
    ├── components/              Screen, AppButton, Card, TimePicker, DayPicker,
    │                            AlarmCard, OptionSheet, SettingRow, …
    ├── screens/                 List, Edit, Ringing, Settings, History
    └── navigation/              native-stack navigator
```

The layers only depend downwards: screens and components read the store, the
store owns persistence and scheduling, and the services are the only code that
touches AsyncStorage or `expo-notifications`. Scheduling decisions are written
as pure functions (`planAll`, `diffSchedule`, `reconcilePastOccurrences`,
`nextOccurrences`) with the side effects kept in thin wrappers, which is what
makes them testable.

### Storage

`AsyncStorage`, one key per concern (`alarms`, `settings`, `history`,
`schedule`, `timeContext`) behind a versioned repository with a migration hook.
Every record is re-validated on read: a malformed alarm is repaired where it
can be and dropped where it cannot, so a corrupt write can never stop the app
from starting.

### Error handling

Scheduling failures are caught per notification, counted, and surfaced as a
banner on the alarm list instead of throwing away the whole sync. Permission
loss, cancelled-notification races and channel errors degrade gracefully. A
render crash is caught by an error boundary that explains that already-scheduled
alarms are unaffected.

## Tests

`npm test` runs 131 tests (Jest + `jest-expo` + React Native Testing Library),
pinned to a DST-observing time zone by `test/globalSetup.ts`. Two fakes stand in
for the platform: `test/fakeNotifications.ts` behaves like the OS scheduler
(identifiers are keys, the pending list can be read back, notifications can be
fired and responded to) and `test/fakeAudio.ts` records playback.

* **`utils/time`** — occurrence maths across "later today", rollover,
  exact-now, repeat-day walks, both DST transitions, next-alarm selection and
  all formatting.
* **`utils/validation`** — draft validation and normalisation, plus recovery of
  damaged stored records.
* **`services/notifications/scheduler`** — identifier round-trips, planning, the
  schedule diff, and `syncSchedule` against the fake OS: repeated syncs stay
  idempotent, a disabled alarm is fully cancelled, an edit leaves nothing at the
  old time, snoozes survive a sync, failures are reported rather than thrown.
* **`services/alarmAudio`** — looping vs. preview playback, and the rule that a
  preview can never silence a ringing alarm.
* **`state/AlarmStore`** — every feature driven through the same API the screens
  use: create, edit, delete, enable/disable, repeat windows, snooze (including
  chained snoozes and snooze-disabled alarms), dismiss, missed alarms, cold
  start from a notification tap, restart/reboot recovery, corrupt storage,
  time-zone changes, settings, and error handling.
* **`theme/ThemeProvider`** — light, dark and system resolution, and that both
  palettes define the same tokens.
* **`App`** — the whole app mounted: empty state, creating an alarm through the
  editor, toggling and deleting from the list, the permission banner, and the
  ringing screen taking over and going away again.

## What is not covered here

The Gradle build and on-device behaviour were not run in the environment this
was developed in (no Android SDK available), so the native side has been
verified as far as `expo prebuild` — the generated manifest carries the expected
permissions and `res/raw` carries the five tones — plus a clean Metro production
bundle for Android and a clean `tsc`. Everything above the native boundary is
covered by the test suite against fakes of the notification and audio modules.

What still needs a physical device: the actual sound coming out of the alarm
stream at alarm volume, exact-alarm delivery under Doze, the lock-screen
appearance of the notification, and reboot rescheduling. Those depend on OEM
behaviour that no fake can stand in for.
