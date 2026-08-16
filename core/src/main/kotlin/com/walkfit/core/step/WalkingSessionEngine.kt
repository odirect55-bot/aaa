package com.walkfit.core.step

import com.walkfit.core.metrics.CalorieCalculator
import com.walkfit.core.metrics.DistanceCalculator
import com.walkfit.core.metrics.StrideCalculator
import com.walkfit.core.model.ActiveSession
import com.walkfit.core.model.CompletedSession
import com.walkfit.core.model.SensorReading
import com.walkfit.core.model.UserProfile
import kotlin.math.abs

/**
 * Tracks a single "Start Walking" session from the same hardware counter that
 * drives the daily total, using independent baselines so the two never
 * interfere.
 *
 * Pure and clock-free, like [StepCounterEngine].
 */
object WalkingSessionEngine {

    fun start(reading: SensorReading, startTimeMillis: Long): ActiveSession = ActiveSession(
        startTimeMillis = startTimeMillis,
        baselineValue = reading.rawCounterValue,
        lastSensorValue = reading.rawCounterValue,
        carriedSteps = 0L,
        bootTimestampMillis = reading.bootTimestampMillis,
        lastUpdatedMillis = startTimeMillis,
    )

    /**
     * Applies a reading to a running session. While paused, steps are ignored
     * but the baseline is kept in sync so resuming does not credit the walk
     * with steps taken during the pause.
     */
    fun onReading(session: ActiveSession, reading: SensorReading): ActiveSession {
        if (reading.rawCounterValue < 0) return session

        val rebooted = abs(reading.bootTimestampMillis - session.bootTimestampMillis) >
            StepCounterEngine.BOOT_TIMESTAMP_TOLERANCE_MILLIS
        val counterWentBackwards = reading.rawCounterValue < session.lastSensorValue

        if (session.isPaused) {
            return session.copy(
                carriedSteps = session.steps,
                baselineValue = reading.rawCounterValue,
                lastSensorValue = reading.rawCounterValue,
                bootTimestampMillis = reading.bootTimestampMillis,
                lastUpdatedMillis = reading.timestampMillis,
            )
        }

        if (rebooted || counterWentBackwards) {
            return session.copy(
                carriedSteps = session.steps,
                baselineValue = reading.rawCounterValue,
                lastSensorValue = reading.rawCounterValue,
                bootTimestampMillis = reading.bootTimestampMillis,
                lastUpdatedMillis = reading.timestampMillis,
            )
        }

        return session.copy(
            lastSensorValue = reading.rawCounterValue,
            bootTimestampMillis = reading.bootTimestampMillis,
            lastUpdatedMillis = reading.timestampMillis,
        )
    }

    fun pause(session: ActiveSession, nowMillis: Long): ActiveSession =
        if (session.isPaused) session else session.copy(isPaused = true, pausedAtMillis = nowMillis)

    fun resume(session: ActiveSession, nowMillis: Long): ActiveSession {
        if (!session.isPaused) return session
        val pausedFor = session.pausedAtMillis?.let { (nowMillis - it).coerceAtLeast(0L) } ?: 0L
        return session.copy(
            isPaused = false,
            pausedAtMillis = null,
            pausedDurationMillis = session.pausedDurationMillis + pausedFor,
        )
    }

    /** Closes the session and computes its estimated distance and calories. */
    fun stop(
        session: ActiveSession,
        endTimeMillis: Long,
        profile: UserProfile,
    ): CompletedSession {
        val duration = session.durationMillis(endTimeMillis)
        val strideMeters = StrideCalculator.strideMeters(profile)
        val distance = DistanceCalculator.distanceMeters(session.steps, strideMeters)
        val calories = CalorieCalculator.estimateCalories(
            distanceMeters = distance,
            weightKg = profile.weightKg,
            durationMillis = duration,
        )
        return CompletedSession(
            startTimeMillis = session.startTimeMillis,
            endTimeMillis = endTimeMillis,
            durationMillis = duration,
            steps = session.steps,
            distanceMeters = distance,
            calories = calories,
        )
    }
}
