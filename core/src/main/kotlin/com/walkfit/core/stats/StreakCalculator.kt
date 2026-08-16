package com.walkfit.core.stats

import com.walkfit.core.model.DailyStepRecord
import java.time.LocalDate

/**
 * Streak rules, stated once so the UI and the notifications agree:
 *
 *  - A day **counts** when its step total reached the goal that was in force
 *    on that day (`steps >= goal`, `goal > 0`).
 *  - A day with no stored record counts as missed.
 *  - The **current streak** is the run of counting days ending today. Today is
 *    still in progress, so a today that has not yet reached its goal does not
 *    break the streak — the run is measured back from yesterday instead. Once
 *    today's goal is reached, today is included.
 *  - The **best streak** is the longest run of counting days ever recorded.
 */
object StreakCalculator {

    fun currentStreak(records: Collection<DailyStepRecord>, today: LocalDate): Int {
        if (records.isEmpty()) return 0
        val achieved = records.filter { it.goalReached }.map { it.date }.toHashSet()

        // Today counts if already reached; otherwise it is simply skipped over
        // (still in progress) and the run is measured from yesterday.
        var cursor = if (achieved.contains(today)) today else today.minusDays(1)
        var streak = 0
        while (achieved.contains(cursor)) {
            streak++
            cursor = cursor.minusDays(1)
        }
        return streak
    }

    fun bestStreak(records: Collection<DailyStepRecord>): Int {
        val achieved = records.filter { it.goalReached }.map { it.date }.distinct().sorted()
        if (achieved.isEmpty()) return 0

        var best = 1
        var run = 1
        for (i in 1 until achieved.size) {
            run = if (achieved[i - 1].plusDays(1) == achieved[i]) run + 1 else 1
            if (run > best) best = run
        }
        return best
    }
}
