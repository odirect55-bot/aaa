package com.walkfit.core.step

import com.walkfit.core.model.SensorReading
import com.walkfit.core.model.StepEvent
import com.walkfit.core.model.StepTrackingState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class StepCounterEngineTest {

    private val day1 = LocalDate.of(2026, 3, 10)
    private val day2 = LocalDate.of(2026, 3, 11)
    private val boot = 1_700_000_000_000L

    private fun reading(raw: Long, at: Long = 1L, bootAt: Long = boot) =
        SensorReading(rawCounterValue = raw, timestampMillis = at, bootTimestampMillis = bootAt)

    // --- first run -----------------------------------------------------------

    @Test
    fun `first reading captures a baseline and credits no steps`() {
        val result = StepCounterEngine.onReading(null, reading(48_320), day1)

        assertEquals(0L, result.stepsToday)
        assertEquals(48_320L, result.state.baselineValue)
        assertEquals(48_320L, result.state.lastSensorValue)
        assertEquals(day1, result.state.date)
        assertTrue(StepEvent.INITIALIZED in result.events)
        assertNull(result.finalizedDay)
    }

    @Test
    fun `raw sensor value is never treated as today's step count`() {
        // A device up for weeks reports a huge counter; today's total must be 0.
        val result = StepCounterEngine.onReading(null, reading(1_204_998), day1)
        assertEquals(0L, result.stepsToday)
    }

    // --- normal counting -----------------------------------------------------

    @Test
    fun `steps today are the delta from the daily baseline`() {
        var state = StepCounterEngine.onReading(null, reading(10_000), day1).state
        state = StepCounterEngine.onReading(state, reading(10_500), day1).state
        state = StepCounterEngine.onReading(state, reading(17_842), day1).state

        assertEquals(7_842L, state.stepsToday)
    }

    @Test
    fun `an unchanged counter reports NO_CHANGE and keeps the total`() {
        val start = StepCounterEngine.onReading(null, reading(500), day1).state
        val same = StepCounterEngine.onReading(start, reading(500), day1)

        assertTrue(StepEvent.NO_CHANGE in same.events)
        assertEquals(0L, same.stepsToday)
    }

    @Test
    fun `a gap in listening still credits the steps the hardware counted`() {
        // The app was killed for two hours; TYPE_STEP_COUNTER kept counting.
        val start = StepCounterEngine.onReading(null, reading(1_000), day1).state
        val afterGap = StepCounterEngine.onReading(start, reading(4_500), day1)

        assertEquals(3_500L, afterGap.stepsToday)
        assertTrue(StepEvent.INCREMENT in afterGap.events)
    }

    // --- reboot --------------------------------------------------------------

    @Test
    fun `device reboot banks the steps so far and re-baselines`() {
        var state = StepCounterEngine.onReading(null, reading(20_000), day1).state
        state = StepCounterEngine.onReading(state, reading(23_000), day1).state
        assertEquals(3_000L, state.stepsToday)

        // Reboot: counter restarts near zero and boot time jumps forward.
        val newBoot = boot + 5_000_000L
        val afterReboot = StepCounterEngine.onReading(state, reading(12, bootAt = newBoot), day1)

        assertTrue(StepEvent.DEVICE_REBOOT in afterReboot.events)
        assertEquals(3_000L, afterReboot.stepsToday)
        assertEquals(3_000L, afterReboot.state.carriedSteps)
        assertEquals(12L, afterReboot.state.baselineValue)

        // Counting continues on top of the banked total.
        val later = StepCounterEngine.onReading(afterReboot.state, reading(512, bootAt = newBoot), day1)
        assertEquals(3_500L, later.stepsToday)
    }

    @Test
    fun `reboot is detected even when the counter comes back higher`() {
        // Some devices persist the counter across reboots; only the boot
        // timestamp reveals what happened.
        var state = StepCounterEngine.onReading(null, reading(1_000), day1).state
        state = StepCounterEngine.onReading(state, reading(2_000), day1).state

        val result = StepCounterEngine.onReading(
            state,
            reading(9_000, bootAt = boot + 900_000L),
            day1,
        )

        assertTrue(StepEvent.DEVICE_REBOOT in result.events)
        // The 7,000 jump is not credited: it cannot be attributed to today.
        assertEquals(1_000L, result.stepsToday)
    }

    @Test
    fun `small boot timestamp jitter is not a reboot`() {
        val state = StepCounterEngine.onReading(null, reading(1_000), day1).state
        val result = StepCounterEngine.onReading(
            state,
            reading(1_200, bootAt = boot + 37L),
            day1,
        )

        assertTrue(StepEvent.DEVICE_REBOOT !in result.events)
        assertEquals(200L, result.stepsToday)
    }

    // --- sensor reset --------------------------------------------------------

    @Test
    fun `counter going backwards without a reboot is treated as a sensor reset`() {
        var state = StepCounterEngine.onReading(null, reading(5_000), day1).state
        state = StepCounterEngine.onReading(state, reading(6_500), day1).state

        val result = StepCounterEngine.onReading(state, reading(40), day1)

        assertTrue(StepEvent.SENSOR_RESET in result.events)
        assertEquals(1_500L, result.stepsToday)
        assertEquals(40L, result.state.baselineValue)
    }

    @Test
    fun `steps are never negative after a reset`() {
        val state = StepCounterEngine.onReading(null, reading(5_000), day1).state
        val result = StepCounterEngine.onReading(state, reading(0), day1)

        assertTrue(result.stepsToday >= 0L)
        assertEquals(0L, result.stepsToday)
    }

    // --- day rollover --------------------------------------------------------

    @Test
    fun `a new day finalizes yesterday and starts from zero`() {
        var state = StepCounterEngine.onReading(null, reading(1_000), day1).state
        state = StepCounterEngine.onReading(state, reading(9_000), day1).state
        assertEquals(8_000L, state.stepsToday)

        val rollover = StepCounterEngine.onReading(state, reading(9_100), day2)

        assertTrue(StepEvent.DAY_ROLLOVER in rollover.events)
        assertNotNull(rollover.finalizedDay)
        assertEquals(day1, rollover.finalizedDay!!.date)
        assertEquals(8_100L, rollover.finalizedDay!!.steps)

        assertEquals(day2, rollover.state.date)
        assertEquals(0L, rollover.stepsToday)
        assertEquals(0L, rollover.state.carriedSteps)
        assertEquals(9_100L, rollover.state.baselineValue)
    }

    @Test
    fun `overnight reboot rolls the day over and keeps yesterday's total`() {
        var state = StepCounterEngine.onReading(null, reading(500), day1).state
        state = StepCounterEngine.onReading(state, reading(6_500), day1).state

        val newBoot = boot + 20_000_000L
        val result = StepCounterEngine.onReading(state, reading(30, bootAt = newBoot), day2)

        assertTrue(StepEvent.DEVICE_REBOOT in result.events)
        assertTrue(StepEvent.DAY_ROLLOVER in result.events)
        assertEquals(6_000L, result.finalizedDay!!.steps)
        assertEquals(day1, result.finalizedDay!!.date)
        assertEquals(0L, result.stepsToday)
        assertEquals(30L, result.state.baselineValue)
    }

    @Test
    fun `scheduled midnight rollover works without a sensor reading`() {
        var state = StepCounterEngine.onReading(null, reading(1_000), day1).state
        state = StepCounterEngine.onReading(state, reading(4_200), day1).state

        val result = StepCounterEngine.onDateChange(state, day2, nowMillis = 99L)

        assertEquals(3_200L, result.finalizedDay!!.steps)
        assertEquals(day2, result.state.date)
        assertEquals(0L, result.stepsToday)
        assertEquals(4_200L, result.state.baselineValue)
    }

    @Test
    fun `onDateChange is a no-op when the date has not advanced`() {
        val state = StepCounterEngine.onReading(null, reading(1_000), day1).state
        val result = StepCounterEngine.onDateChange(state, day1, nowMillis = 5L)

        assertNull(result.finalizedDay)
        assertEquals(state, result.state)
    }

    @Test
    fun `multi-day gap finalizes only the day that was open`() {
        var state = StepCounterEngine.onReading(null, reading(100), day1).state
        state = StepCounterEngine.onReading(state, reading(2_100), day1).state

        val threeDaysLater = day1.plusDays(3)
        val result = StepCounterEngine.onReading(state, reading(2_600), threeDaysLater)

        assertEquals(day1, result.finalizedDay!!.date)
        assertEquals(2_500L, result.finalizedDay!!.steps)
        assertEquals(threeDaysLater, result.state.date)
        assertEquals(0L, result.stepsToday)
    }

    // --- defensive -----------------------------------------------------------

    @Test
    fun `clock moving backwards does not rewrite history`() {
        var state = StepCounterEngine.onReading(null, reading(1_000), day2).state
        state = StepCounterEngine.onReading(state, reading(3_000), day2).state

        val result = StepCounterEngine.onReading(state, reading(3_400), day1)

        assertTrue(StepEvent.CLOCK_ROLLBACK in result.events)
        assertNull(result.finalizedDay)
        assertEquals(day2, result.state.date)
        assertEquals(2_400L, result.stepsToday)
    }

    @Test
    fun `a negative counter value is rejected and leaves state untouched`() {
        val state = StepCounterEngine.onReading(null, reading(1_000), day1).state
        val withSteps = StepCounterEngine.onReading(state, reading(1_600), day1).state

        val result = StepCounterEngine.onReading(withSteps, reading(-5), day1)

        assertTrue(StepEvent.INVALID_READING in result.events)
        assertEquals(withSteps, result.state)
        assertEquals(600L, result.stepsToday)
    }

    @Test
    fun `state survives an app restart because it is reconstructed from storage`() {
        // Simulates: persist state, process dies, state is read back, next
        // reading arrives.
        val original = StepCounterEngine.onReading(null, reading(700), day1).state
        val counted = StepCounterEngine.onReading(original, reading(3_700), day1).state

        val restored = StepTrackingState(
            date = counted.date,
            baselineValue = counted.baselineValue,
            lastSensorValue = counted.lastSensorValue,
            carriedSteps = counted.carriedSteps,
            bootTimestampMillis = counted.bootTimestampMillis,
            lastUpdatedMillis = counted.lastUpdatedMillis,
        )

        val afterRestart = StepCounterEngine.onReading(restored, reading(4_000), day1)
        assertEquals(3_300L, afterRestart.stepsToday)
    }
}
