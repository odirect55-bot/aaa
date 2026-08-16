package com.walkfit.core.model

/**
 * Biological sex, used only as an input to the stride-length estimate.
 * [UNSPECIFIED] is always a valid choice and yields a neutral estimate.
 */
enum class Sex {
    MALE,
    FEMALE,
    UNSPECIFIED,
}

/**
 * Locally stored user profile. Nothing here ever leaves the device.
 *
 * Every measurement is optional: WalkFit counts steps correctly with an empty
 * profile, it simply falls back to population averages for the derived
 * distance/calorie estimates.
 */
data class UserProfile(
    val name: String = "",
    val ageYears: Int? = null,
    val weightKg: Double? = null,
    val heightCm: Double? = null,
    val sex: Sex = Sex.UNSPECIFIED,
    /** Manually configured stride length in centimetres. Overrides the estimate. */
    val strideLengthCm: Double? = null,
    val dailyStepGoal: Int = DEFAULT_DAILY_GOAL,
) {
    companion object {
        const val DEFAULT_DAILY_GOAL: Int = 10_000

        /** Used by the calorie estimate when the user has not entered a weight. */
        const val FALLBACK_WEIGHT_KG: Double = 70.0

        val EMPTY: UserProfile = UserProfile()
    }
}
