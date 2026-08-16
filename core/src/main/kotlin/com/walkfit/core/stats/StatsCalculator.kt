package com.walkfit.core.stats

import com.walkfit.core.model.DailyStepRecord
import java.time.LocalDate
import kotlin.math.roundToLong

/** Lifetime figures shown on the dashboard and profile. */
data class WalkingStats(
    val currentStreak: Int,
    val bestStreak: Int,
    val goalsCompleted: Int,
    val totalSteps: Long,
    val totalDistanceMeters: Double,
    val totalCalories: Double,
    val averageDailySteps: Long,
    val daysTracked: Int,
    val bestDaySteps: Long,
    val bestDayDate: LocalDate?,
) {
    companion object {
        /** Neutral value for loading and empty states. */
        val EMPTY: WalkingStats = WalkingStats(
            currentStreak = 0,
            bestStreak = 0,
            goalsCompleted = 0,
            totalSteps = 0L,
            totalDistanceMeters = 0.0,
            totalCalories = 0.0,
            averageDailySteps = 0L,
            daysTracked = 0,
            bestDaySteps = 0L,
            bestDayDate = null,
        )
    }
}

object StatsCalculator {

    /**
     * @param today excluded from the average, because a day that is still in
     *   progress would otherwise drag it down all morning. Today's steps are
     *   still counted in [WalkingStats.totalSteps] and in the streak.
     */
    fun compute(records: Collection<DailyStepRecord>, today: LocalDate): WalkingStats {
        if (records.isEmpty()) return WalkingStats.EMPTY

        val completedDays = records.filter { it.date != today }
        val averageBase = completedDays.ifEmpty { records }
        val best = records.maxByOrNull { it.steps }

        return WalkingStats(
            currentStreak = StreakCalculator.currentStreak(records, today),
            bestStreak = StreakCalculator.bestStreak(records),
            goalsCompleted = records.count { it.goalReached },
            totalSteps = records.sumOf { it.steps },
            totalDistanceMeters = records.sumOf { it.distanceMeters },
            totalCalories = records.sumOf { it.calories },
            averageDailySteps = average(averageBase),
            daysTracked = records.size,
            bestDaySteps = best?.steps ?: 0L,
            bestDayDate = best?.date,
        )
    }

    /** Mean steps across [records]; 0 when empty. */
    fun average(records: Collection<DailyStepRecord>): Long {
        if (records.isEmpty()) return 0L
        return (records.sumOf { it.steps }.toDouble() / records.size).roundToLong()
    }

    /**
     * Mean steps over the [days] calendar days ending at [endDate], counting
     * days with no record as zero so a week off does not flatter the average.
     */
    fun averageOverWindow(
        records: Collection<DailyStepRecord>,
        endDate: LocalDate,
        days: Int,
    ): Long {
        if (days <= 0) return 0L
        val start = endDate.minusDays((days - 1).toLong())
        val total = records
            .filter { !it.date.isBefore(start) && !it.date.isAfter(endDate) }
            .sumOf { it.steps }
        return (total.toDouble() / days).roundToLong()
    }
}
