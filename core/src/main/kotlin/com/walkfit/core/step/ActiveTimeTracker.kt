package com.walkfit.core.step

/**
 * Measures how long the user actually spent walking, rather than guessing it
 * from the step count.
 *
 * Whenever the counter moves forward, the gap since the previous increment is
 * added to the day's active time — but only if that gap is short enough to be
 * part of the same walk. A larger gap means the user stopped, so it is not
 * counted at all.
 */
object ActiveTimeTracker {

    /**
     * Longest gap between two step increments still considered one continuous
     * walk. Step-counter batching means increments can arrive tens of seconds
     * apart even while walking steadily.
     */
    const val MAX_GAP_MILLIS: Long = 90_000L

    data class Update(
        val activeMillis: Long,
        val lastStepMillis: Long,
    )

    /**
     * @param activeMillis active time banked for the day so far.
     * @param lastStepMillis when the counter last moved, or `null` if it has
     *   not moved yet today.
     * @param stepsDelta steps added by this reading; zero or fewer is a no-op.
     */
    fun onStepIncrement(
        activeMillis: Long,
        lastStepMillis: Long?,
        nowMillis: Long,
        stepsDelta: Long,
    ): Update {
        if (stepsDelta <= 0L) {
            return Update(activeMillis, lastStepMillis ?: nowMillis)
        }
        if (lastStepMillis == null) {
            return Update(activeMillis, nowMillis)
        }
        val gap = nowMillis - lastStepMillis
        val credited = if (gap in 0..MAX_GAP_MILLIS) gap else 0L
        return Update(activeMillis + credited, nowMillis)
    }
}
