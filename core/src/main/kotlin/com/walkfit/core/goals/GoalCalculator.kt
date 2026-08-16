package com.walkfit.core.goals

/** Progress of a step count against a daily goal. */
data class GoalProgress(
    val steps: Long,
    val goal: Int,
    /** 0.0..1.0, clamped for drawing the progress ring. */
    val fraction: Float,
    /** Whole percent, **not** clamped, so "142%" can be shown. */
    val percent: Int,
    val remaining: Long,
    val isComplete: Boolean,
)

object GoalCalculator {

    /** Offered as quick picks in the Goals screen; any custom value is allowed. */
    val PRESET_GOALS: List<Int> = listOf(5_000, 7_500, 10_000, 12_500, 15_000)

    const val MIN_GOAL: Int = 500
    const val MAX_GOAL: Int = 100_000

    fun progress(steps: Long, goal: Int): GoalProgress {
        val safeSteps = steps.coerceAtLeast(0L)
        if (goal <= 0) {
            return GoalProgress(safeSteps, 0, 0f, 0, 0L, false)
        }
        val ratio = safeSteps.toDouble() / goal
        return GoalProgress(
            steps = safeSteps,
            goal = goal,
            fraction = ratio.coerceIn(0.0, 1.0).toFloat(),
            percent = (ratio * 100).toInt(),
            remaining = (goal - safeSteps).coerceAtLeast(0L),
            isComplete = safeSteps >= goal,
        )
    }

    /** Clamps a user-entered goal into the accepted range. */
    fun sanitizeGoal(goal: Int): Int = goal.coerceIn(MIN_GOAL, MAX_GOAL)

    fun isValidGoal(goal: Int): Boolean = goal in MIN_GOAL..MAX_GOAL
}
