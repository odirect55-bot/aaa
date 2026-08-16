package com.walkfit.core.metrics

import com.walkfit.core.model.UserProfile

/**
 * Converts a step count into an estimated distance.
 *
 * This is step-count x stride-length, not a GPS trace: it is an estimate and
 * the UI always labels it as one.
 */
object DistanceCalculator {

    fun distanceMeters(steps: Long, strideMeters: Double): Double =
        if (steps <= 0L) 0.0 else steps * strideMeters

    fun distanceMeters(steps: Long, profile: UserProfile): Double =
        distanceMeters(steps, StrideCalculator.strideMeters(profile))

    fun distanceKilometers(steps: Long, profile: UserProfile): Double =
        distanceMeters(steps, profile) / 1000.0

    fun metersToKilometers(meters: Double): Double = meters / 1000.0

    fun metersToMiles(meters: Double): Double = meters / 1609.344

    /** Average speed in km/h, or 0 when no time has elapsed. */
    fun speedKmh(distanceMeters: Double, durationMillis: Long): Double {
        if (durationMillis <= 0L) return 0.0
        val hours = durationMillis / 3_600_000.0
        return (distanceMeters / 1000.0) / hours
    }
}
