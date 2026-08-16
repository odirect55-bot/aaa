package com.walkfit.core.history

import com.walkfit.core.model.DailyStepRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class HistoryAggregatorTest {

    private val today = LocalDate.of(2026, 5, 20) // a Wednesday

    private fun record(date: LocalDate, steps: Long, goal: Int = 10_000) = DailyStepRecord(
        date = date,
        steps = steps,
        goal = goal,
        distanceMeters = steps * 0.75,
        calories = steps * 0.03,
    )

    @Test
    fun `the daily series is continuous and ends on the requested day`() {
        val records = listOf(record(today, 5_000), record(today.minusDays(3), 8_000))
        val series = HistoryAggregator.dailySeries(records, today, days = 7, defaultGoal = 10_000)

        assertEquals(7, series.size)
        assertEquals(today.minusDays(6), series.first().date)
        assertEquals(today, series.last().date)
    }

    @Test
    fun `untracked days appear as explicit zeroes instead of gaps`() {
        val series = HistoryAggregator.dailySeries(
            records = listOf(record(today, 5_000)),
            endDate = today,
            days = 3,
            defaultGoal = 8_000,
        )

        assertEquals(0L, series[0].steps)
        assertEquals(8_000, series[0].goal)
        assertEquals(5_000L, series[2].steps)
    }

    @Test
    fun `a 30 day window returns 30 points`() {
        val series = HistoryAggregator.dailySeries(emptyList(), today, days = 30, defaultGoal = 10_000)
        assertEquals(30, series.size)
        assertTrue(series.all { it.steps == 0L })
    }

    @Test
    fun `weekly buckets sum the days they contain`() {
        val records = listOf(
            record(today, 5_000),
            record(today.minusDays(1), 6_000),
            record(today.minusDays(2), 4_000),
        )
        val weeks = HistoryAggregator.weeklySeries(records, today, weeks = 4, defaultGoal = 10_000)

        assertEquals(4, weeks.size)
        // The current (partial) week is last and holds Mon..Wed.
        assertEquals(15_000L, weeks.last().steps)
        assertEquals(3, weeks.last().daysCounted)
    }

    @Test
    fun `a partial week averages over elapsed days only`() {
        val records = listOf(
            record(today, 6_000),
            record(today.minusDays(1), 6_000),
            record(today.minusDays(2), 6_000),
        )
        val current = HistoryAggregator.weeklySeries(records, today, weeks = 1, defaultGoal = 10_000).single()

        assertEquals(6_000L, current.averageStepsPerDay)
    }

    @Test
    fun `monthly buckets group by calendar month`() {
        val records = listOf(
            record(LocalDate.of(2026, 5, 2), 9_000),
            record(LocalDate.of(2026, 5, 3), 11_000),
            record(LocalDate.of(2026, 4, 15), 7_000),
        )
        val months = HistoryAggregator.monthlySeries(records, today, months = 3, defaultGoal = 10_000)

        assertEquals(3, months.size)
        assertEquals("MAY", months.last().label)
        assertEquals(20_000L, months.last().steps)
        assertEquals(7_000L, months[1].steps) // April
    }

    @Test
    fun `bucket goal completion uses the summed daily goals`() {
        val records = (0 until 7).map { record(today.minusDays(it.toLong()), 10_000) }
        val week = HistoryAggregator.weeklySeries(records, today, weeks = 1, defaultGoal = 10_000).single()

        // Mon..Wed of the current week: 3 days x 10,000 goal, 30,000 walked.
        assertEquals(30_000, week.goal)
        assertTrue(week.goalReached)
    }

    @Test
    fun `zero or negative windows return nothing rather than throwing`() {
        assertTrue(HistoryAggregator.dailySeries(emptyList(), today, 0, 10_000).isEmpty())
        assertTrue(HistoryAggregator.weeklySeries(emptyList(), today, 0, 10_000).isEmpty())
        assertTrue(HistoryAggregator.monthlySeries(emptyList(), today, -1, 10_000).isEmpty())
    }
}
