package com.walkfit.core.metrics

import com.walkfit.core.model.UserProfile

/**
 * Estimates energy expenditure for walking.
 *
 * Two models, picked by what is known:
 *
 *  - **MET model** (used when a duration is available). The standard
 *    `kcal = MET x 3.5 x weightKg / 200 x minutes` relation, with the MET value
 *    taken from a walking-speed table.
 *  - **Distance model** (no usable duration). `kcal = 0.57 x weightKg x km`,
 *    the common approximation for the energy cost of walking a kilometre.
 *
 * These are population approximations, not measurements. Nothing here is
 * medically exact and the UI labels every calorie figure as an estimate.
 */
object CalorieCalculator {

    const val KCAL_PER_KG_PER_KM: Double = 0.57

    /** Speeds outside this range are treated as unreliable timing data. */
    private const val MIN_PLAUSIBLE_SPEED_KMH = 0.5
    private const val MAX_PLAUSIBLE_SPEED_KMH = 12.0

    fun estimateCalories(
        distanceMeters: Double,
        weightKg: Double?,
        durationMillis: Long = 0L,
    ): Double {
        if (distanceMeters <= 0.0) return 0.0
        val weight = effectiveWeight(weightKg)
        val km = distanceMeters / 1000.0

        if (durationMillis > 0L) {
            val speed = DistanceCalculator.speedKmh(distanceMeters, durationMillis)
            if (speed in MIN_PLAUSIBLE_SPEED_KMH..MAX_PLAUSIBLE_SPEED_KMH) {
                val minutes = durationMillis / 60_000.0
                return metForSpeed(speed) * 3.5 * weight / 200.0 * minutes
            }
        }

        return KCAL_PER_KG_PER_KM * weight * km
    }

    fun estimateCaloriesForSteps(
        steps: Long,
        profile: UserProfile,
        durationMillis: Long = 0L,
    ): Double = estimateCalories(
        distanceMeters = DistanceCalculator.distanceMeters(steps, profile),
        weightKg = profile.weightKg,
        durationMillis = durationMillis,
    )

    /** Walking MET values by speed, from the Compendium of Physical Activities. */
    fun metForSpeed(speedKmh: Double): Double = when {
        speedKmh < 3.2 -> 2.8
        speedKmh < 4.0 -> 3.0
        speedKmh < 4.8 -> 3.5
        speedKmh < 5.6 -> 4.3
        speedKmh < 6.4 -> 5.0
        speedKmh < 7.2 -> 7.0
        else -> 8.3
    }

    private fun effectiveWeight(weightKg: Double?): Double =
        weightKg?.takeIf { it in 20.0..350.0 } ?: UserProfile.FALLBACK_WEIGHT_KG
}
