package com.walkfit.core.history

import com.walkfit.core.model.DailyStepRecord
import java.time.LocalDate
import java.time.YearMonth
import java.time.temporal.WeekFields
import kotlin.math.roundToLong

/** One bar in a chart. */
data class ChartBucket(
    val label: String,
    val startDate: LocalDate,
    val endDate: LocalDate,
    val steps: Long,
    val goal: Int,
    val distanceMeters: Double,
    val calories: Double,
    val daysCounted: Int,
) {
    val averageStepsPerDay: Long
        get() = if (daysCounted <= 0) 0L else (steps.toDouble() / daysCounted).roundToLong()

    /** Goal here is the *summed* goal for the bucket, so this stays meaningful. */
    val goalReached: Boolean
        get() = goal > 0 && steps >= goal
}

/**
 * Turns stored daily rows into the series the History screen draws.
 *
 * Days with no stored record are materialised as explicit zero-step entries so
 * charts keep a continuous time axis instead of silently closing gaps.
 */
object HistoryAggregator {

    /**
     * Continuous list of days from `endDate - (days - 1)` to `endDate`,
     * oldest first. Missing days become zero-step records carrying
     * [defaultGoal].
     */
    fun dailySeries(
        records: Collection<DailyStepRecord>,
        endDate: LocalDate,
        days: Int,
        defaultGoal: Int,
    ): List<DailyStepRecord> {
        if (days <= 0) return emptyList()
        val byDate = records.associateBy { it.date }
        val start = endDate.minusDays((days - 1).toLong())
        return (0 until days).map { offset ->
            val date = start.plusDays(offset.toLong())
            byDate[date] ?: DailyStepRecord(
                date = date,
                steps = 0L,
                goal = defaultGoal,
                distanceMeters = 0.0,
                calories = 0.0,
            )
        }
    }

    /**
     * Groups the last [weeks] weeks into buckets, most recent week last.
     * Weeks start on the locale-independent ISO Monday.
     */
    fun weeklySeries(
        records: Collection<DailyStepRecord>,
        endDate: LocalDate,
        weeks: Int,
        defaultGoal: Int,
    ): List<ChartBucket> {
        if (weeks <= 0) return emptyList()
        val weekFields = WeekFields.ISO
        val currentWeekStart = endDate.with(weekFields.dayOfWeek(), 1L)
        return (weeks - 1 downTo 0).map { back ->
            val start = currentWeekStart.minusWeeks(back.toLong())
            val end = start.plusDays(6)
            bucket(
                records = records,
                start = start,
                end = minOf(end, endDate),
                label = "${start.monthValue}/${start.dayOfMonth}",
                defaultGoal = defaultGoal,
            )
        }
    }

    /** Groups the last [months] calendar months into buckets, most recent last. */
    fun monthlySeries(
        records: Collection<DailyStepRecord>,
        endDate: LocalDate,
        months: Int,
        defaultGoal: Int,
    ): List<ChartBucket> {
        if (months <= 0) return emptyList()
        val currentMonth = YearMonth.from(endDate)
        return (months - 1 downTo 0).map { back ->
            val month = currentMonth.minusMonths(back.toLong())
            val start = month.atDay(1)
            val end = minOf(month.atEndOfMonth(), endDate)
            bucket(
                records = records,
                start = start,
                end = end,
                label = month.month.name.take(3),
                defaultGoal = defaultGoal,
            )
        }
    }

    /**
     * Sums `start..end` inclusive. Elapsed days are counted, not the nominal
     * length of the period, so the current (partial) week or month is not
     * penalised in its average or its aggregate goal.
     */
    private fun bucket(
        records: Collection<DailyStepRecord>,
        start: LocalDate,
        end: LocalDate,
        label: String,
        defaultGoal: Int,
    ): ChartBucket {
        if (end.isBefore(start)) {
            return ChartBucket(label, start, start, 0L, 0, 0.0, 0.0, 0)
        }
        val byDate = records.associateBy { it.date }
        val days = (java.time.temporal.ChronoUnit.DAYS.between(start, end) + 1).toInt()
        var steps = 0L
        var goal = 0L
        var distance = 0.0
        var calories = 0.0
        for (offset in 0 until days) {
            val record = byDate[start.plusDays(offset.toLong())]
            steps += record?.steps ?: 0L
            goal += (record?.goal ?: defaultGoal).toLong()
            distance += record?.distanceMeters ?: 0.0
            calories += record?.calories ?: 0.0
        }
        return ChartBucket(
            label = label,
            startDate = start,
            endDate = end,
            steps = steps,
            goal = goal.coerceAtMost(Int.MAX_VALUE.toLong()).toInt(),
            distanceMeters = distance,
            calories = calories,
            daysCounted = days,
        )
    }
}
