package com.walkfit.core.step

import com.walkfit.core.model.FinalizedDay
import com.walkfit.core.model.SensorReading
import com.walkfit.core.model.StepEvent
import com.walkfit.core.model.StepTrackingState
import com.walkfit.core.model.StepUpdateResult
import java.time.LocalDate
import kotlin.math.abs

/**
 * Turns the Android step counter's raw, cumulative, reboot-resetting value into
 * a reliable per-calendar-day step total.
 *
 * `Sensor.TYPE_STEP_COUNTER` reports steps since the device booted — never
 * steps today — so the app has to maintain its own daily baseline:
 *
 *     stepsToday = carriedSteps + (currentValue - startOfSegmentValue)
 *
 * This object is pure: no Android types, no clock access, no I/O. Every input
 * (the reading, the current date) is passed in, which makes each edge case
 * below directly unit-testable.
 *
 * Handled conditions:
 *  - **First run** — capture a baseline, credit nothing.
 *  - **Normal increment** — credit the delta.
 *  - **Device reboot** — boot timestamp jumps: bank the current segment and
 *    re-baseline at the new value.
 *  - **Sensor/counter reset** — value goes backwards without a reboot: same
 *    treatment as a reboot.
 *  - **Day change** — close out the previous day and start a fresh baseline.
 *  - **App restart / gap in listening** — the counter kept running in hardware,
 *    so the delta is real and is credited in full.
 *  - **Clock moved backwards** — ignored rather than corrupting history.
 *  - **Invalid reading** — rejected, state untouched.
 */
object StepCounterEngine {

    /**
     * Boot-time estimates jitter by a few milliseconds between reads because
     * `currentTimeMillis()` and `elapsedRealtime()` are not sampled atomically.
     * Only a change larger than this is treated as a real reboot.
     */
    const val BOOT_TIMESTAMP_TOLERANCE_MILLIS: Long = 60_000L

    /**
     * Applies a sensor reading to the stored state.
     *
     * @param previous last persisted state, or `null` on first run.
     * @param reading the raw sensor reading.
     * @param today the calendar day the reading belongs to (caller supplies it
     *   so that time zone handling stays in one place).
     */
    fun onReading(
        previous: StepTrackingState?,
        reading: SensorReading,
        today: LocalDate,
    ): StepUpdateResult {
        if (reading.rawCounterValue < 0) {
            val fallback = previous ?: newDay(today, reading)
            return StepUpdateResult(fallback, null, setOf(StepEvent.INVALID_READING))
        }

        if (previous == null) {
            return StepUpdateResult(
                state = newDay(today, reading),
                finalizedDay = null,
                events = setOf(StepEvent.INITIALIZED),
            )
        }

        val events = mutableSetOf<StepEvent>()

        // The clock going backwards (time zone change, manual adjustment) must
        // never rewrite an already-recorded day. Keep counting into the day we
        // are on and flag it.
        if (today.isBefore(previous.date)) {
            events += StepEvent.CLOCK_ROLLBACK
            val continued = applySegment(previous, reading, events)
            return StepUpdateResult(continued, null, events)
        }

        // 1. Reconcile the sensor segment against the stored one, banking any
        //    steps counted before a reboot or reset.
        val reconciled = applySegment(previous, reading, events)

        // 2. Cross a day boundary if needed. Steps observed in this reading are
        //    credited to the day that was open when they were counted; the new
        //    day starts from the current raw value.
        if (today != reconciled.date) {
            val finalized = FinalizedDay(reconciled.date, reconciled.stepsToday)
            events += StepEvent.DAY_ROLLOVER
            return StepUpdateResult(
                state = newDay(today, reading),
                finalizedDay = finalized,
                events = events,
            )
        }

        return StepUpdateResult(reconciled, null, events)
    }

    /**
     * Rolls the day over without a sensor reading — used by the scheduled
     * midnight worker so history is correct even if the user takes no steps
     * around the boundary.
     *
     * Returns the state unchanged (no [FinalizedDay]) if [newDate] is not
     * actually later than the state's date.
     */
    fun onDateChange(
        previous: StepTrackingState,
        newDate: LocalDate,
        nowMillis: Long,
    ): StepUpdateResult {
        if (!newDate.isAfter(previous.date)) {
            return StepUpdateResult(previous, null, emptySet())
        }
        return StepUpdateResult(
            state = StepTrackingState(
                date = newDate,
                baselineValue = previous.lastSensorValue,
                lastSensorValue = previous.lastSensorValue,
                carriedSteps = 0L,
                bootTimestampMillis = previous.bootTimestampMillis,
                lastUpdatedMillis = nowMillis,
            ),
            finalizedDay = FinalizedDay(previous.date, previous.stepsToday),
            events = setOf(StepEvent.DAY_ROLLOVER),
        )
    }

    /**
     * Detects reboot / counter reset and returns the state with the reading
     * applied to the *same* calendar day.
     */
    private fun applySegment(
        previous: StepTrackingState,
        reading: SensorReading,
        events: MutableSet<StepEvent>,
    ): StepTrackingState {
        val rebooted = abs(reading.bootTimestampMillis - previous.bootTimestampMillis) >
            BOOT_TIMESTAMP_TOLERANCE_MILLIS
        val counterWentBackwards = reading.rawCounterValue < previous.lastSensorValue

        if (rebooted || counterWentBackwards) {
            events += if (rebooted) StepEvent.DEVICE_REBOOT else StepEvent.SENSOR_RESET
            // Bank the segment we had been counting, then re-baseline at the
            // current value. Steps taken between the reboot and this first
            // reading are unknowable, so they are deliberately not credited:
            // under-counting is acceptable, inventing steps is not.
            return previous.copy(
                carriedSteps = previous.stepsToday,
                baselineValue = reading.rawCounterValue,
                lastSensorValue = reading.rawCounterValue,
                bootTimestampMillis = reading.bootTimestampMillis,
                lastUpdatedMillis = reading.timestampMillis,
            )
        }

        events += if (reading.rawCounterValue > previous.lastSensorValue) {
            StepEvent.INCREMENT
        } else {
            StepEvent.NO_CHANGE
        }

        return previous.copy(
            lastSensorValue = reading.rawCounterValue,
            bootTimestampMillis = reading.bootTimestampMillis,
            lastUpdatedMillis = reading.timestampMillis,
        )
    }

    private fun newDay(date: LocalDate, reading: SensorReading) = StepTrackingState(
        date = date,
        baselineValue = reading.rawCounterValue,
        lastSensorValue = reading.rawCounterValue,
        carriedSteps = 0L,
        bootTimestampMillis = reading.bootTimestampMillis,
        lastUpdatedMillis = reading.timestampMillis,
    )
}
