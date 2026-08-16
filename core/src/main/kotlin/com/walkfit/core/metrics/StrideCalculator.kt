package com.walkfit.core.metrics

import com.walkfit.core.model.Sex
import com.walkfit.core.model.UserProfile

/**
 * Estimates stride length, in metres.
 *
 * Precedence:
 *  1. the stride length the user configured manually;
 *  2. a height-derived estimate (the standard 0.415 x height for men /
 *     0.413 x height for women anthropometric ratio);
 *  3. a population-average fallback.
 *
 * Everything except case 1 is an estimate and is labelled as such in the UI.
 */
object StrideCalculator {

    const val HEIGHT_FACTOR_MALE: Double = 0.415
    const val HEIGHT_FACTOR_FEMALE: Double = 0.413
    const val HEIGHT_FACTOR_UNSPECIFIED: Double = 0.414

    const val FALLBACK_STRIDE_MALE_M: Double = 0.762
    const val FALLBACK_STRIDE_FEMALE_M: Double = 0.670
    const val FALLBACK_STRIDE_UNSPECIFIED_M: Double = 0.715

    /** Plausibility bounds; anything outside is treated as a typo. */
    const val MIN_STRIDE_M: Double = 0.30
    const val MAX_STRIDE_M: Double = 1.30
    const val MIN_HEIGHT_CM: Double = 90.0
    const val MAX_HEIGHT_CM: Double = 250.0

    fun strideMeters(profile: UserProfile): Double {
        val manual = profile.strideLengthCm?.div(100.0)
        if (manual != null && manual in MIN_STRIDE_M..MAX_STRIDE_M) {
            return manual
        }

        val height = profile.heightCm
        if (height != null && height in MIN_HEIGHT_CM..MAX_HEIGHT_CM) {
            return (height / 100.0) * heightFactor(profile.sex)
        }

        return fallbackStride(profile.sex)
    }

    /** True when the returned stride comes from a real user-supplied value. */
    fun isUserConfigured(profile: UserProfile): Boolean {
        val manual = profile.strideLengthCm?.div(100.0)
        return manual != null && manual in MIN_STRIDE_M..MAX_STRIDE_M
    }

    fun heightFactor(sex: Sex): Double = when (sex) {
        Sex.MALE -> HEIGHT_FACTOR_MALE
        Sex.FEMALE -> HEIGHT_FACTOR_FEMALE
        Sex.UNSPECIFIED -> HEIGHT_FACTOR_UNSPECIFIED
    }

    fun fallbackStride(sex: Sex): Double = when (sex) {
        Sex.MALE -> FALLBACK_STRIDE_MALE_M
        Sex.FEMALE -> FALLBACK_STRIDE_FEMALE_M
        Sex.UNSPECIFIED -> FALLBACK_STRIDE_UNSPECIFIED_M
    }
}
