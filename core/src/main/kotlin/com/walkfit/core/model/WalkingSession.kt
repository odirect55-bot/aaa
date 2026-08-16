package com.walkfit.core.model

/**
 * A walking session that is currently running.
 *
 * Sessions use the same segment arithmetic as the daily counter so that a
 * reboot or counter reset mid-session does not lose or invent steps, and so a
 * session that crosses midnight still reports its own totals correctly.
 */
data class ActiveSession(
    val startTimeMillis: Long,
    val baselineValue: Long,
    val lastSensorValue: Long,
    val carriedSteps: Long,
    val bootTimestampMillis: Long,
    val lastUpdatedMillis: Long,
    /** Milliseconds the session spent paused, excluded from the duration. */
    val pausedDurationMillis: Long = 0L,
    val isPaused: Boolean = false,
    val pausedAtMillis: Long? = null,
) {
    val steps: Long
        get() = carriedSteps + (lastSensorValue - baselineValue).coerceAtLeast(0L)

    /** Elapsed active time at [nowMillis], excluding paused stretches. */
    fun durationMillis(nowMillis: Long): Long {
        val pausedNow = if (isPaused && pausedAtMillis != null) nowMillis - pausedAtMillis else 0L
        return (nowMillis - startTimeMillis - pausedDurationMillis - pausedNow).coerceAtLeast(0L)
    }
}

/** A finished walking session, ready to be written to history. */
data class CompletedSession(
    val startTimeMillis: Long,
    val endTimeMillis: Long,
    val durationMillis: Long,
    val steps: Long,
    val distanceMeters: Double,
    val calories: Double,
)
