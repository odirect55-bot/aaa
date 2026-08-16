package com.walkfit.core.notifications

import com.walkfit.core.model.AppSettings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NotificationPlannerTest {

    private val settings = AppSettings.DEFAULT

    @Test
    fun `nothing is planned when notifications are switched off`() {
        val off = settings.copy(notificationsEnabled = false)
        assertNull(NotificationPlanner.plan(10_500, 10_000, off, emptySet()))
        assertNull(NotificationPlanner.planMorningReminder(10_000, off, emptySet()))
    }

    @Test
    fun `the near-goal nudge fires inside the threshold`() {
        val planned = NotificationPlanner.plan(9_200, 10_000, settings, emptySet())

        assertEquals(NotificationKind.NEAR_GOAL, planned?.kind)
        assertTrue(planned!!.body.contains("800"))
    }

    @Test
    fun `no nudge while still far from the goal`() {
        assertNull(NotificationPlanner.plan(4_000, 10_000, settings, emptySet()))
    }

    @Test
    fun `reaching the goal produces the celebration`() {
        val planned = NotificationPlanner.plan(10_000, 10_000, settings, emptySet())
        assertEquals(NotificationKind.GOAL_ACHIEVED, planned?.kind)
    }

    @Test
    fun `each nudge fires at most once a day`() {
        assertNull(
            NotificationPlanner.plan(
                steps = 9_500,
                goal = 10_000,
                settings = settings,
                alreadySentToday = setOf(NotificationKind.NEAR_GOAL),
            ),
        )
        assertNull(
            NotificationPlanner.plan(
                steps = 12_000,
                goal = 10_000,
                settings = settings,
                alreadySentToday = setOf(NotificationKind.GOAL_ACHIEVED),
            ),
        )
    }

    @Test
    fun `individual nudges can be disabled without silencing the rest`() {
        val noNearGoal = settings.copy(nearGoalReminderEnabled = false)

        assertNull(NotificationPlanner.plan(9_500, 10_000, noNearGoal, emptySet()))
        assertEquals(
            NotificationKind.GOAL_ACHIEVED,
            NotificationPlanner.plan(10_100, 10_000, noNearGoal, emptySet())?.kind,
        )
    }

    @Test
    fun `the morning reminder mentions the goal`() {
        val planned = NotificationPlanner.planMorningReminder(10_000, settings, emptySet())
        assertTrue(planned!!.body.contains("10,000"))
    }

    @Test
    fun `an unset goal produces no nudges`() {
        assertNull(NotificationPlanner.plan(5_000, 0, settings, emptySet()))
    }
}
