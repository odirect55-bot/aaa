package com.walkfit.core.goals

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GoalCalculatorTest {

    @Test
    fun `progress reports fraction percent and remaining`() {
        val progress = GoalCalculator.progress(steps = 7_842, goal = 10_000)

        assertEquals(0.7842f, progress.fraction, 1e-6f)
        assertEquals(78, progress.percent)
        assertEquals(2_158L, progress.remaining)
        assertFalse(progress.isComplete)
    }

    @Test
    fun `reaching the goal exactly completes it`() {
        val progress = GoalCalculator.progress(10_000, 10_000)

        assertTrue(progress.isComplete)
        assertEquals(0L, progress.remaining)
        assertEquals(100, progress.percent)
        assertEquals(1f, progress.fraction, 1e-6f)
    }

    @Test
    fun `exceeding the goal clamps the ring but not the percentage`() {
        val progress = GoalCalculator.progress(14_200, 10_000)

        assertEquals(1f, progress.fraction, 1e-6f)
        assertEquals(142, progress.percent)
        assertEquals(0L, progress.remaining)
    }

    @Test
    fun `a zero or negative goal cannot divide by zero`() {
        val progress = GoalCalculator.progress(5_000, 0)

        assertEquals(0f, progress.fraction, 1e-6f)
        assertEquals(0, progress.percent)
        assertFalse(progress.isComplete)
    }

    @Test
    fun `negative step counts are floored at zero`() {
        assertEquals(0L, GoalCalculator.progress(-5, 10_000).steps)
    }

    @Test
    fun `custom goals are clamped into the accepted range`() {
        assertEquals(GoalCalculator.MIN_GOAL, GoalCalculator.sanitizeGoal(1))
        assertEquals(GoalCalculator.MAX_GOAL, GoalCalculator.sanitizeGoal(999_999))
        assertEquals(12_500, GoalCalculator.sanitizeGoal(12_500))

        assertFalse(GoalCalculator.isValidGoal(0))
        assertTrue(GoalCalculator.isValidGoal(10_000))
    }

    @Test
    fun `the documented presets are offered`() {
        assertEquals(listOf(5_000, 7_500, 10_000, 12_500, 15_000), GoalCalculator.PRESET_GOALS)
    }
}
