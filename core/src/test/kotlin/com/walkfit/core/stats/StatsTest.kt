package com.walkfit.core.stats

import com.walkfit.core.model.DailyStepRecord
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

private fun record(date: LocalDate, steps: Long, goal: Int = 10_000) = DailyStepRecord(
    date = date,
    steps = steps,
    goal = goal,
    distanceMeters = steps * 0.75,
    calories = steps * 0.03,
)

class StreakCalculatorTest {

    private val today = LocalDate.of(2026, 5, 20)

    @Test
    fun `no records means no streak`() {
        assertEquals(0, StreakCalculator.currentStreak(emptyList(), today))
        assertEquals(0, StreakCalculator.bestStreak(emptyList()))
    }

    @Test
    fun `consecutive completed days ending today count`() {
        val records = listOf(
            record(today, 10_500),
            record(today.minusDays(1), 12_000),
            record(today.minusDays(2), 10_000),
        )
        assertEquals(3, StreakCalculator.currentStreak(records, today))
    }

    @Test
    fun `an incomplete today does not break the streak`() {
        val records = listOf(
            record(today, 2_100),          // still walking
            record(today.minusDays(1), 11_000),
            record(today.minusDays(2), 10_400),
        )
        assertEquals(2, StreakCalculator.currentStreak(records, today))
    }

    @Test
    fun `a missed yesterday with an incomplete today ends the streak`() {
        val records = listOf(
            record(today, 500),
            record(today.minusDays(1), 3_000),
            record(today.minusDays(2), 12_000),
        )
        assertEquals(0, StreakCalculator.currentStreak(records, today))
    }

    @Test
    fun `a missing day counts as missed`() {
        val records = listOf(
            record(today, 11_000),
            // no record at all for yesterday
            record(today.minusDays(2), 12_000),
        )
        assertEquals(1, StreakCalculator.currentStreak(records, today))
    }

    @Test
    fun `the goal in force on each day decides whether it counts`() {
        val records = listOf(
            record(today, 6_000, goal = 5_000),        // reached the goal that day
            record(today.minusDays(1), 6_000, goal = 10_000), // did not
        )
        assertEquals(1, StreakCalculator.currentStreak(records, today))
    }

    @Test
    fun `best streak finds the longest historical run`() {
        val start = LocalDate.of(2026, 4, 1)
        val records = buildList {
            // 5-day run
            repeat(5) { add(record(start.plusDays(it.toLong()), 11_000)) }
            // gap
            add(record(start.plusDays(6), 200))
            // 3-day run
            repeat(3) { add(record(start.plusDays((8 + it).toLong()), 10_000)) }
        }
        assertEquals(5, StreakCalculator.bestStreak(records))
    }
}

class StatsCalculatorTest {

    private val today = LocalDate.of(2026, 5, 20)

    @Test
    fun `empty history produces zeroed stats rather than throwing`() {
        val stats = StatsCalculator.compute(emptyList(), today)
        assertEquals(0L, stats.totalSteps)
        assertEquals(0L, stats.averageDailySteps)
        assertEquals(0, stats.daysTracked)
        assertEquals(null, stats.bestDayDate)
    }

    @Test
    fun `the in-progress day is excluded from the average but counted in totals`() {
        val records = listOf(
            record(today, 100),                   // barely started
            record(today.minusDays(1), 10_000),
            record(today.minusDays(2), 12_000),
        )
        val stats = StatsCalculator.compute(records, today)

        assertEquals(22_100L, stats.totalSteps)
        assertEquals(11_000L, stats.averageDailySteps)
        assertEquals(3, stats.daysTracked)
    }

    @Test
    fun `goals completed and best day are reported`() {
        val records = listOf(
            record(today.minusDays(1), 10_400),
            record(today.minusDays(2), 15_000),
            record(today.minusDays(3), 900),
        )
        val stats = StatsCalculator.compute(records, today)

        assertEquals(2, stats.goalsCompleted)
        assertEquals(15_000L, stats.bestDaySteps)
        assertEquals(today.minusDays(2), stats.bestDayDate)
    }

    @Test
    fun `a windowed average counts untracked days as zero`() {
        val records = listOf(
            record(today, 7_000),
            record(today.minusDays(1), 7_000),
        )
        // 14,000 steps spread over a 7-day window.
        assertEquals(2_000L, StatsCalculator.averageOverWindow(records, today, 7))
    }
}
