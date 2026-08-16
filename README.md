# WalkFit

An Android walking and step-counter app that reads your **real** steps from the
phone's hardware step counter. It never generates, estimates or hardcodes a step
count: if the device has no step counter, WalkFit says so instead of showing a
number.

---

## Running it on your phone

You need [Android Studio](https://developer.android.com/studio) (Ladybug or
newer) and a **physical Android phone** — an emulator has no step-counter
hardware, so the app will correctly report that step counting is unsupported
there.

### Option A — Android Studio (recommended)

1. **Open the project.** Android Studio → *Open* → select this repository's root
   folder. Let it finish the Gradle sync; it downloads the Android Gradle Plugin,
   AndroidX and Room on first run.
2. **Install the SDK if prompted.** The project targets **compileSdk 35** and
   needs **JDK 17**. Android Studio bundles a suitable JDK; if you build from the
   command line, set `JAVA_HOME` to a JDK 17 installation.
3. **Enable developer mode on the phone.** Settings → *About phone* → tap
   *Build number* seven times → back → *System* → *Developer options* → turn on
   **USB debugging**.
4. **Plug the phone in** over USB and accept the "Allow USB debugging?" prompt on
   the phone. The device should appear in Android Studio's device dropdown.
5. **Press Run (▶)** with the `app` configuration selected.
6. **Grant the permissions** when the app asks:
   - **Physical activity** — required. Android will not let any app read the step
     counter without it. If you decline, WalkFit shows an explanation and a
     button into system settings; it never falls back to fake data.
   - **Notifications** — optional. Used for the ongoing tracking notification and
     the goal reminders. Declining only means you see no notifications.
7. **Walk.** Take 20–30 steps with the phone in your hand or pocket. Hardware step
   counters deliberately need a few consecutive steps before they report, so the
   number does not move on the first step or two.

### Option B — command line

```bash
# from the repository root, with a phone connected and USB debugging on
./gradlew :app:installDebug

# or build an APK to copy across manually
./gradlew :app:assembleDebug
# -> app/build/outputs/apk/debug/app-debug.apk
```

`adb devices` should list your phone before you run either command.

### Verifying it is reading the real sensor

- Open **Profile → Sensor status**. It reports whether this device has a step
  counter, whether a step detector is present, and whether the permission has
  been granted. This is read live from `SensorManager`.
- Note the number on the dashboard, walk 50 steps, and watch it rise. The count
  comes from `Sensor.TYPE_STEP_COUNTER` only.
- Force-stop the app, walk, then reopen it: the steps you took are still counted,
  because the hardware counter kept running and WalkFit reconciles against its
  stored baseline on the next reading.

### If the step count stays at zero

- **Check Profile → Sensor status first.** "Not available" means the phone has no
  step-counter hardware and no app can count steps on it.
- Some manufacturers (notably Xiaomi, Huawei, Oppo, Samsung) aggressively kill
  background apps. Allow WalkFit to run in the background and disable battery
  optimisation for it if background counting stops overnight.
- The counter needs a short walk before it starts reporting; shaking the phone
  will not produce steps.

---

## What it does

**Dashboard** — today's steps in a large animated progress ring with percentage
and goal, plus estimated distance, estimated calories and measured walking time.
Streak, daily average and goals-hit summary underneath.

**Walking sessions** — an optional "Start walking" mode that tracks one walk
separately (live timer, steps, distance, calories), pausable, and saved to
history when finished.

**History** — today and yesterday at a glance, selectable 7 / 30 / 90-day ranges,
daily / weekly / monthly bar charts, per-day records (date, steps, goal, distance,
calories, completion percent) and a list of saved walking sessions.

**Goals** — five presets (5,000 / 7,500 / 10,000 / 12,500 / 15,000) plus any
custom value, with achievements: current streak, best streak, goals completed,
total steps, daily average, days tracked.

**Profile** — name, age, weight, height, sex and an optional manual stride
length, all stored locally. Notification toggles, background-tracking toggle,
light/dark/system theme, and km/miles.

---

## How the step counting actually works

`Sensor.TYPE_STEP_COUNTER` reports **steps since the device booted**, not steps
today, and it resets to zero on reboot. Treating its raw value as "today's steps"
is the classic bug in step-counter apps. WalkFit keeps its own baseline:

```
stepsToday = carriedSteps + (lastSensorValue - baselineValue)
```

`baselineValue` is the counter reading at the start of the current *sensor
segment*, and `carriedSteps` banks everything counted earlier the same day — so a
reboot at lunchtime does not erase the morning.

All of this lives in [`StepCounterEngine`](core/src/main/kotlin/com/walkfit/core/step/StepCounterEngine.kt),
which is pure Kotlin with no Android dependencies, so every edge case is unit
tested:

| Condition | Behaviour |
| --- | --- |
| First run | Capture a baseline, credit zero steps |
| Normal increment | Credit the delta |
| App killed / not listening | Full delta credited — the hardware kept counting |
| Device reboot | Bank the segment, re-baseline at the new value |
| Reboot with a *higher* counter | Still detected, via the boot-timestamp change |
| Counter goes backwards | Treated as a sensor reset, same handling |
| New calendar day | Yesterday finalised into history, fresh baseline for today |
| Multi-day gap | Only the day that was open is finalised |
| Clock moved backwards | Ignored, never rewrites recorded history |
| Negative / invalid reading | Rejected, stored state untouched |
| No step counter | Reported to the user; no data is invented |
| Permission denied | Explanation plus a link to settings; no data is invented |

The reboot check uses `System.currentTimeMillis() - SystemClock.elapsedRealtime()`
rather than only "did the counter go down", because some devices come back from a
reboot with a *higher* value, which a naive check misses entirely.

Steps taken between a reboot and the app's first reading afterwards cannot be
attributed to anyone, so they are deliberately **not** credited. Under-counting
slightly is acceptable; inventing steps is not.

---

## Background tracking and battery

- A foreground service (`health` type) owns the single sensor listener.
- While the dashboard is visible, the counter is delivered unbatched so the
  number on screen keeps up. When the app goes to the background, registration
  switches to a **5-minute batch latency**, letting the SoC's sensor hub buffer
  events so the CPU stays asleep.
- `TYPE_STEP_DETECTOR` is attached only in the foreground, and only as a hint to
  flush the counter (rate-limited to once every 2s). It never contributes to a
  stored total.
- An hourly `WorkManager` job takes a single reading as a safety net for when the
  service is not running — which works precisely because the hardware counter
  never stops.
- A daily worker just after midnight closes out the previous day even if you took
  no steps around the boundary.
- Turning background tracking off in Profile stops the service entirely; the
  hourly sync still keeps your daily total correct.

---

## Estimates, stated plainly

- **Steps** are measured by the hardware.
- **Distance** is `steps x stride length` — an estimate, labelled as one in the
  UI. Stride comes from your manual value if set, otherwise from your height
  (0.415 x height for men, 0.413 for women), otherwise a population average.
- **Calories** are an estimate. With a measured duration WalkFit uses the MET
  model (`MET x 3.5 x kg / 200 x minutes`, MET from walking speed); otherwise
  `0.57 x kg x km`. Without a weight it falls back to 70 kg.
- **Walking time** is measured, not derived from step count: gaps between step
  increments shorter than 90 seconds count as continuous walking, longer gaps do
  not count at all.

None of this is medical-grade, and the app says so on screen.

---

## Architecture

```
core/                        Pure Kotlin/JVM — no Android dependencies
  model/                     UserProfile, DailyStepRecord, StepTrackingState, sessions, settings
  step/                      StepCounterEngine, WalkingSessionEngine, ActiveTimeTracker
  metrics/                   Stride, distance and calorie estimation
  goals/  stats/  history/   Goal progress, streaks, lifetime stats, chart aggregation
  notifications/  format/    Nudge rules, display formatting

app/
  data/local/                Room entities, DAOs, database
  data/repository/           StepRepository, ProfileRepository, SessionRepository, SettingsRepository
  data/mapper/  data/util/   Entity <-> model mapping, clock indirection
  sensor/                    StepSensorController — the only class that touches SensorManager
  service/                   Foreground tracking service, boot receiver
  work/                      Periodic sync, daily rollover, morning reminder
  session/                   Walking-session controller and its crash-safe store
  notifications/             Channels and notification building
  di/                        AppContainer (manual DI)
  ui/                        Compose screens, ViewModels, theme, components
```

Splitting the domain logic into a dependency-free `:core` module is what makes
the step arithmetic testable on a plain JVM, with no emulator and no mocking of
`SensorManager`.

Dependency injection is a hand-written `AppContainer` rather than Hilt: the graph
is application-scoped and small, so the wiring is one readable file and the build
carries one annotation processor (Room) instead of two.

### Database

Room, five tables, `exportSchema = true`, no destructive migration — history is
the point of the app.

| Table | Contents |
| --- | --- |
| `daily_steps` | date (PK), steps, goal, distance, calories, sensorBaseline, sensorLastValue, carriedSteps, bootTimestamp, activeMillis, lastStepMillis, createdAt, updatedAt |
| `walking_sessions` | id, startTime, endTime, duration, steps, distance, calories, date |
| `user_profile` | single row: name, age, weight, height, sex, stride |
| `goal` | single row: daily step goal |
| `app_settings` | single row: notification toggles, theme, units, nudge bookkeeping |

Everything stays on the device. There is no network code in this project.

---

## Building and testing

```bash
./gradlew :core:test              # domain logic — runs on any JVM, no Android SDK
./gradlew :app:testDebugUnitTest  # mappers and date keys
./gradlew :app:assembleDebug      # debug APK
./gradlew build                   # everything
```

`:core:test` covers the daily calculation, new-day reset, counter increases,
sensor resets, reboot handling (including the higher-counter case), app restart,
clock rollback, invalid readings, goal progress, streaks, lifetime stats,
distance, calories, session tracking, active-time measurement, history
aggregation, notification rules and formatting.

CI (`.github/workflows/android.yml`) runs both test suites, assembles the debug
APK and uploads it as a build artifact.

---

## Requirements

- minSdk 26 (Android 8.0) · targetSdk 35 · compileSdk 35
- Kotlin 2.0.21, AGP 8.7.3, Gradle 8.9, JDK 17
- Jetpack Compose (Material 3), Room, WorkManager
- A device with `Sensor.TYPE_STEP_COUNTER`

### Permissions

| Permission | Why |
| --- | --- |
| `ACTIVITY_RECOGNITION` | Required from Android 10 to read the step counter |
| `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_HEALTH` | Continuous background tracking |
| `RECEIVE_BOOT_COMPLETED` | Re-baseline the counter after a reboot |
| `POST_NOTIFICATIONS` | Optional — tracking notification and goal reminders |
