package com.walkfit.core.metrics

import com.walkfit.core.model.Sex
import com.walkfit.core.model.UserProfile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class StrideCalculatorTest {

    @Test
    fun `a manually configured stride wins`() {
        val profile = UserProfile(heightCm = 180.0, strideLengthCm = 82.0, sex = Sex.MALE)
        assertEquals(0.82, StrideCalculator.strideMeters(profile), 1e-9)
        assertTrue(StrideCalculator.isUserConfigured(profile))
    }

    @Test
    fun `stride is derived from height when not configured`() {
        val male = UserProfile(heightCm = 180.0, sex = Sex.MALE)
        assertEquals(1.80 * 0.415, StrideCalculator.strideMeters(male), 1e-9)

        val female = UserProfile(heightCm = 165.0, sex = Sex.FEMALE)
        assertEquals(1.65 * 0.413, StrideCalculator.strideMeters(female), 1e-9)

        assertFalse(StrideCalculator.isUserConfigured(male))
    }

    @Test
    fun `an empty profile falls back to a population average`() {
        assertEquals(
            StrideCalculator.FALLBACK_STRIDE_UNSPECIFIED_M,
            StrideCalculator.strideMeters(UserProfile.EMPTY),
            1e-9,
        )
    }

    @Test
    fun `implausible values are ignored rather than trusted`() {
        val typoStride = UserProfile(heightCm = 175.0, strideLengthCm = 7000.0, sex = Sex.MALE)
        // Falls through to the height estimate instead of returning 70 m.
        assertEquals(1.75 * 0.415, StrideCalculator.strideMeters(typoStride), 1e-9)

        val typoHeight = UserProfile(heightCm = 17.0, sex = Sex.MALE)
        assertEquals(StrideCalculator.FALLBACK_STRIDE_MALE_M, StrideCalculator.strideMeters(typoHeight), 1e-9)
    }
}

class DistanceCalculatorTest {

    @Test
    fun `distance is steps times stride`() {
        assertEquals(7_500.0, DistanceCalculator.distanceMeters(10_000, 0.75), 1e-9)
    }

    @Test
    fun `zero or negative steps means zero distance`() {
        assertEquals(0.0, DistanceCalculator.distanceMeters(0, 0.75), 1e-9)
        assertEquals(0.0, DistanceCalculator.distanceMeters(-10, 0.75), 1e-9)
    }

    @Test
    fun `distance for a realistic profile lands in the expected range`() {
        val profile = UserProfile(heightCm = 175.0, sex = Sex.MALE)
        val km = DistanceCalculator.distanceKilometers(7_842, profile)
        assertTrue("expected ~5.7 km but was $km", km > 5.0 && km < 6.5)
    }

    @Test
    fun `speed is zero when no time has elapsed`() {
        assertEquals(0.0, DistanceCalculator.speedKmh(1_000.0, 0L), 1e-9)
    }

    @Test
    fun `speed converts to km per hour`() {
        // 5 km in 1 hour.
        assertEquals(5.0, DistanceCalculator.speedKmh(5_000.0, 3_600_000L), 1e-9)
    }
}

class CalorieCalculatorTest {

    @Test
    fun `no distance means no calories`() {
        assertEquals(0.0, CalorieCalculator.estimateCalories(0.0, 70.0), 1e-9)
    }

    @Test
    fun `distance model scales with weight and distance`() {
        val light = CalorieCalculator.estimateCalories(5_000.0, 60.0)
        val heavy = CalorieCalculator.estimateCalories(5_000.0, 90.0)

        assertEquals(0.57 * 60.0 * 5.0, light, 1e-9)
        assertTrue(heavy > light)
    }

    @Test
    fun `a missing weight uses the documented fallback rather than zero`() {
        val estimated = CalorieCalculator.estimateCalories(5_000.0, null)
        assertEquals(0.57 * UserProfile.FALLBACK_WEIGHT_KG * 5.0, estimated, 1e-9)
    }

    @Test
    fun `MET model is used when a plausible duration is known`() {
        // 5 km in 1 hour => 5 km/h => MET 4.3.
        val kcal = CalorieCalculator.estimateCalories(5_000.0, 70.0, durationMillis = 3_600_000L)
        val expected = 4.3 * 3.5 * 70.0 / 200.0 * 60.0
        assertEquals(expected, kcal, 1e-6)
    }

    @Test
    fun `an implausible duration falls back to the distance model`() {
        // 5 km in one second is not walking; do not produce a nonsense MET.
        val kcal = CalorieCalculator.estimateCalories(5_000.0, 70.0, durationMillis = 1_000L)
        assertEquals(0.57 * 70.0 * 5.0, kcal, 1e-9)
    }

    @Test
    fun `faster walking burns more per minute`() {
        assertTrue(CalorieCalculator.metForSpeed(6.5) > CalorieCalculator.metForSpeed(3.0))
    }

    @Test
    fun `estimating from steps uses the profile stride`() {
        val profile = UserProfile(heightCm = 175.0, weightKg = 70.0, sex = Sex.MALE)
        val fromSteps = CalorieCalculator.estimateCaloriesForSteps(10_000, profile)
        val distance = DistanceCalculator.distanceMeters(10_000, profile)
        assertEquals(CalorieCalculator.estimateCalories(distance, 70.0), fromSteps, 1e-9)
    }
}
