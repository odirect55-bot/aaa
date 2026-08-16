package com.walkfit.core.notifications

import com.walkfit.core.model.AppSettings

/** The kinds of nudge WalkFit can post. */
enum class NotificationKind {
    MORNING_REMINDER,
    NEAR_GOAL,
    GOAL_ACHIEVED,
}

data class PlannedNotification(
    val kind: NotificationKind,
    val title: String,
    val body: String,
)

/**
 * Decides *whether* a nudge is due. Kept pure so the rules — including "never
 * more than once per day per kind" — can be tested without a running device.
 */
object NotificationPlanner {

    /** How close to the goal the "almost there" nudge fires. */
    const val NEAR_GOAL_THRESHOLD_STEPS: Long = 1_000L

    /**
     * @param alreadySentToday kinds already posted today, so a nudge is not
     *   repeated every time the service updates.
     */
    fun plan(
        steps: Long,
        goal: Int,
        settings: AppSettings,
        alreadySentToday: Set<NotificationKind>,
    ): PlannedNotification? {
        if (!settings.notificationsEnabled || goal <= 0) return null

        val remaining = goal - steps

        if (steps >= goal) {
            if (!settings.goalAchievedAlertEnabled) return null
            if (NotificationKind.GOAL_ACHIEVED in alreadySentToday) return null
            return PlannedNotification(
                kind = NotificationKind.GOAL_ACHIEVED,
                title = "Daily goal completed 🎉",
                body = "Great job! You reached ${format(goal.toLong())} steps today.",
            )
        }

        if (remaining in 1..NEAR_GOAL_THRESHOLD_STEPS) {
            if (!settings.nearGoalReminderEnabled) return null
            if (NotificationKind.NEAR_GOAL in alreadySentToday) return null
            if (NotificationKind.GOAL_ACHIEVED in alreadySentToday) return null
            return PlannedNotification(
                kind = NotificationKind.NEAR_GOAL,
                title = "Almost there!",
                body = "You're only ${format(remaining)} steps away from your goal.",
            )
        }

        return null
    }

    /** The scheduled morning nudge, subject to its own toggle. */
    fun planMorningReminder(
        goal: Int,
        settings: AppSettings,
        alreadySentToday: Set<NotificationKind>,
    ): PlannedNotification? {
        if (!settings.notificationsEnabled || !settings.morningReminderEnabled) return null
        if (NotificationKind.MORNING_REMINDER in alreadySentToday) return null
        return PlannedNotification(
            kind = NotificationKind.MORNING_REMINDER,
            title = "Good morning!",
            body = "Let's reach your ${format(goal.toLong())}-step goal today.",
        )
    }

    private fun format(value: Long): String {
        val text = value.toString()
        val builder = StringBuilder()
        for ((index, char) in text.withIndex()) {
            if (index > 0 && (text.length - index) % 3 == 0) builder.append(',')
            builder.append(char)
        }
        return builder.toString()
    }
}
