package com.walkfit.core.model

import java.time.LocalDate

/**
 * Whether this device can actually count steps.
 *
 * WalkFit never substitutes estimated or generated numbers for a missing
 * sensor; the UI reports the condition instead.
 */
enum class SensorAvailability {
    /** `Sensor.TYPE_STEP_COUNTER` is present and usable. */
    AVAILABLE,

    /** No hardware step counter on this device. */
    UNSUPPORTED,

    /** Sensor exists but `ACTIVITY_RECOGNITION` has not been granted. */
    PERMISSION_REQUIRED,
}

/**
 * A single reading of `Sensor.TYPE_STEP_COUNTER`.
 *
 * @param rawCounterValue the sensor's own cumulative counter. It counts steps
 *   since the device last booted (while the sensor was powered), **not** steps
 *   today, and it resets to zero on reboot.
 * @param timestampMillis wall-clock time the reading was taken.
 * @param bootTimestampMillis approximate wall-clock time the device booted,
 *   computed as `System.currentTimeMillis() - SystemClock.elapsedRealtime()`.
 *   A change here is the most reliable reboot signal available, because a
 *   reboot can otherwise be invisible (the counter may come back up higher
 *   than the value we last saw).
 */
data class SensorReading(
    val rawCounterValue: Long,
    val timestampMillis: Long,
    val bootTimestampMillis: Long,
)

/**
 * Everything WalkFit must persist to turn a cumulative, reboot-resetting
 * hardware counter into "steps taken today".
 *
 * The day's total is split in two parts so that a reboot mid-day loses nothing:
 *
 *   stepsToday = carriedSteps + (lastSensorValue - baselineValue)
 *
 * where the bracketed part is the *current sensor segment* (since the last
 * boot or counter reset) and [carriedSteps] is the sum of all earlier segments
 * for the same calendar day.
 */
data class StepTrackingState(
    /** Calendar day these numbers belong to. */
    val date: LocalDate,
    /** Raw counter value at the start of the current segment. */
    val baselineValue: Long,
    /** Most recent raw counter value observed. */
    val lastSensorValue: Long,
    /** Steps already banked today from previous segments (pre-reboot). */
    val carriedSteps: Long,
    /** Boot time associated with the current segment. */
    val bootTimestampMillis: Long,
    /** Wall-clock time of the last successful update. */
    val lastUpdatedMillis: Long,
) {
    /** Steps counted in the current sensor segment. Never negative. */
    val segmentSteps: Long
        get() = (lastSensorValue - baselineValue).coerceAtLeast(0L)

    /** Total steps for [date]. */
    val stepsToday: Long
        get() = carriedSteps + segmentSteps
}

/** What happened during a [com.walkfit.core.step.StepCounterEngine] update. */
enum class StepEvent {
    /** First ever reading: a baseline was captured, no steps credited. */
    INITIALIZED,

    /** Counter moved forward normally. */
    INCREMENT,

    /** Counter reported the same value as before. */
    NO_CHANGE,

    /** Boot time changed: the device restarted, the counter restarted at 0. */
    DEVICE_REBOOT,

    /** Counter went backwards without a reboot: sensor/firmware reset. */
    SENSOR_RESET,

    /** The reading belongs to a later calendar day than the stored state. */
    DAY_ROLLOVER,

    /** The reading's date is *earlier* than the stored state's date. */
    CLOCK_ROLLBACK,

    /** The reading was rejected (e.g. a negative counter value). */
    INVALID_READING,
}

/** A calendar day closed out by a rollover, ready to be written to history. */
data class FinalizedDay(
    val date: LocalDate,
    val steps: Long,
)

/**
 * Outcome of feeding a reading to the engine.
 *
 * @param state the state to persist.
 * @param finalizedDay set when a day boundary was crossed; the caller must
 *   store this total before overwriting today's row.
 * @param events why the state changed. Several can occur at once (a reboot
 *   overnight produces both [StepEvent.DEVICE_REBOOT] and
 *   [StepEvent.DAY_ROLLOVER]).
 */
data class StepUpdateResult(
    val state: StepTrackingState,
    val finalizedDay: FinalizedDay? = null,
    val events: Set<StepEvent> = emptySet(),
) {
    val stepsToday: Long get() = state.stepsToday
}
