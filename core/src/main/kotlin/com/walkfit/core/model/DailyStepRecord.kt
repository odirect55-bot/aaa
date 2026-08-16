package com.walkfit.core.model

import java.time.LocalDate

/**
 * One calendar day of walking, as shown in history.
 *
 * Distance and calories are stored alongside the step count rather than being
 * recomputed on read, so that changing your weight today does not silently
 * rewrite last month's numbers.
 */
data class DailyStepRecord(
    val date: LocalDate,
    val steps: Long,
    val goal: Int,
    val distanceMeters: Double,
    val calories: Double,
    /** Measured walking time for the day; see `ActiveTimeTracker`. */
    val activeMillis: Long = 0L,
) {
    val goalReached: Boolean
        get() = goal > 0 && steps >= goal

    /** 0.0..1.0, clamped. */
    val progress: Float
        get() = if (goal <= 0) 0f else (steps.toDouble() / goal).coerceIn(0.0, 1.0).toFloat()

    /** Whole-percent completion, not clamped (can exceed 100). */
    val completionPercent: Int
        get() = if (goal <= 0) 0 else ((steps * 100.0) / goal).toInt()
}
