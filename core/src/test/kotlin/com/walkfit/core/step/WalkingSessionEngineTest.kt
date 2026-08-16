package com.walkfit.core.step

import com.walkfit.core.model.SensorReading
import com.walkfit.core.model.Sex
import com.walkfit.core.model.UserProfile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WalkingSessionEngineTest {

    private val boot = 1_700_000_000_000L
    private val profile = UserProfile(heightCm = 175.0, weightKg = 72.0, sex = Sex.MALE)

    private fun reading(raw: Long, at: Long = 0L, bootAt: Long = boot) =
        SensorReading(raw, at, bootAt)

    @Test
    fun `a new session starts at zero regardless of the raw counter`() {
        val session = WalkingSessionEngine.start(reading(883_120), startTimeMillis = 1_000L)
        assertEquals(0L, session.steps)
    }

    @Test
    fun `session steps are counted from the session baseline`() {
        var session = WalkingSessionEngine.start(reading(1_000), 0L)
        session = WalkingSessionEngine.onReading(session, reading(1_450))
        session = WalkingSessionEngine.onReading(session, reading(3_200))

        assertEquals(2_200L, session.steps)
    }

    @Test
    fun `duration excludes paused time`() {
        var session = WalkingSessionEngine.start(reading(0), startTimeMillis = 0L)
        session = WalkingSessionEngine.pause(session, nowMillis = 60_000L)
        session = WalkingSessionEngine.resume(session, nowMillis = 120_000L)

        // 3 minutes wall clock, 1 minute of it paused.
        assertEquals(120_000L, session.durationMillis(180_000L))
    }

    @Test
    fun `steps taken while paused are not credited to the session`() {
        var session = WalkingSessionEngine.start(reading(0), 0L)
        session = WalkingSessionEngine.onReading(session, reading(300))
        session = WalkingSessionEngine.pause(session, 10_000L)
        session = WalkingSessionEngine.onReading(session, reading(900))   // walked while paused
        session = WalkingSessionEngine.resume(session, 20_000L)
        session = WalkingSessionEngine.onReading(session, reading(1_100))

        assertEquals(500L, session.steps)
    }

    @Test
    fun `a reboot mid-session keeps the steps counted so far`() {
        var session = WalkingSessionEngine.start(reading(5_000), 0L)
        session = WalkingSessionEngine.onReading(session, reading(6_200))
        assertEquals(1_200L, session.steps)

        session = WalkingSessionEngine.onReading(session, reading(15, bootAt = boot + 10_000_000L))
        assertEquals(1_200L, session.steps)

        session = WalkingSessionEngine.onReading(session, reading(315, bootAt = boot + 10_000_000L))
        assertEquals(1_500L, session.steps)
    }

    @Test
    fun `stopping computes duration steps distance and calories`() {
        var session = WalkingSessionEngine.start(reading(0), startTimeMillis = 0L)
        session = WalkingSessionEngine.onReading(session, reading(4_000))

        val completed = WalkingSessionEngine.stop(session, endTimeMillis = 1_800_000L, profile = profile)

        assertEquals(4_000L, completed.steps)
        assertEquals(1_800_000L, completed.durationMillis)
        assertEquals(0L, completed.startTimeMillis)
        assertEquals(1_800_000L, completed.endTimeMillis)
        assertTrue(completed.distanceMeters > 0.0)
        assertTrue(completed.calories > 0.0)
    }

    @Test
    fun `a session with no steps reports zero distance and calories`() {
        val session = WalkingSessionEngine.start(reading(1_000), 0L)
        val completed = WalkingSessionEngine.stop(session, 60_000L, profile)

        assertEquals(0L, completed.steps)
        assertEquals(0.0, completed.distanceMeters, 1e-9)
        assertEquals(0.0, completed.calories, 1e-9)
    }

    @Test
    fun `an invalid reading is ignored`() {
        var session = WalkingSessionEngine.start(reading(100), 0L)
        session = WalkingSessionEngine.onReading(session, reading(400))
        val before = session.steps

        session = WalkingSessionEngine.onReading(session, reading(-1))
        assertEquals(before, session.steps)
    }
}

class ActiveTimeTrackerTest {

    @Test
    fun `the first increment only starts the clock`() {
        val update = ActiveTimeTracker.onStepIncrement(
            activeMillis = 0L,
            lastStepMillis = null,
            nowMillis = 1_000L,
            stepsDelta = 5L,
        )
        assertEquals(0L, update.activeMillis)
        assertEquals(1_000L, update.lastStepMillis)
    }

    @Test
    fun `a short gap between increments counts as walking time`() {
        val update = ActiveTimeTracker.onStepIncrement(
            activeMillis = 60_000L,
            lastStepMillis = 100_000L,
            nowMillis = 110_000L,
            stepsDelta = 12L,
        )
        assertEquals(70_000L, update.activeMillis)
    }

    @Test
    fun `a long idle gap is not counted as walking`() {
        val update = ActiveTimeTracker.onStepIncrement(
            activeMillis = 60_000L,
            lastStepMillis = 100_000L,
            nowMillis = 100_000L + ActiveTimeTracker.MAX_GAP_MILLIS + 1,
            stepsDelta = 12L,
        )
        assertEquals(60_000L, update.activeMillis)
    }

    @Test
    fun `no steps means no time is added`() {
        val update = ActiveTimeTracker.onStepIncrement(60_000L, 100_000L, 130_000L, 0L)
        assertEquals(60_000L, update.activeMillis)
    }
}
