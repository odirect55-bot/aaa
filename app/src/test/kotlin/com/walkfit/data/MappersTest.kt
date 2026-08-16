package com.walkfit.data

import com.walkfit.core.model.AppSettings
import com.walkfit.core.model.DistanceUnit
import com.walkfit.core.model.Sex
import com.walkfit.core.model.ThemeMode
import com.walkfit.core.model.UserProfile
import com.walkfit.data.local.AppSettingsEntity
import com.walkfit.data.local.DailyStepsEntity
import com.walkfit.data.local.UserProfileEntity
import com.walkfit.data.mapper.toEntity
import com.walkfit.data.mapper.toProfile
import com.walkfit.data.mapper.toRecord
import com.walkfit.data.mapper.toSettings
import com.walkfit.data.mapper.toTrackingState
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class MappersTest {

    private fun dailyRow(steps: Long = 5_000L) = DailyStepsEntity(
        date = "2026-04-02",
        steps = steps,
        goal = 10_000,
        distanceMeters = 3_750.0,
        calories = 200.0,
        sensorBaseline = 1_000L,
        sensorLastValue = 6_000L,
        carriedSteps = 0L,
        bootTimestamp = 1_700_000_000_000L,
        activeMillis = 900_000L,
        lastStepMillis = 1_700_000_500_000L,
        createdAt = 1L,
        updatedAt = 2L,
    )

    @Test
    fun `a daily row maps to a history record`() {
        val record = dailyRow().toRecord()

        assertEquals(LocalDate.of(2026, 4, 2), record.date)
        assertEquals(5_000L, record.steps)
        assertEquals(50, record.completionPercent)
        assertEquals(900_000L, record.activeMillis)
    }

    @Test
    fun `a daily row restores the sensor tracking state`() {
        val state = dailyRow().toTrackingState()

        assertEquals(LocalDate.of(2026, 4, 2), state.date)
        assertEquals(1_000L, state.baselineValue)
        assertEquals(6_000L, state.lastSensorValue)
        assertEquals(5_000L, state.stepsToday)
    }

    @Test
    fun `profile round trips through its entity`() {
        val profile = UserProfile(
            name = "Sam",
            ageYears = 34,
            weightKg = 71.5,
            heightCm = 176.0,
            sex = Sex.FEMALE,
            strideLengthCm = 72.0,
            dailyStepGoal = 12_500,
        )

        val restored = profile.toEntity(updatedAt = 10L).toProfile(dailyStepGoal = 12_500)
        assertEquals(profile, restored)
    }

    @Test
    fun `an unrecognised enum name falls back instead of throwing`() {
        val entity = UserProfileEntity(
            id = UserProfileEntity.SINGLETON_ID,
            name = "",
            ageYears = null,
            weightKg = null,
            heightCm = null,
            sex = "NOT_A_VALUE",
            strideLengthCm = null,
            updatedAt = 0L,
        )
        assertEquals(Sex.UNSPECIFIED, entity.toProfile(10_000).sex)

        val settings = AppSettingsEntity(
            id = AppSettingsEntity.SINGLETON_ID,
            notificationsEnabled = true,
            morningReminderEnabled = true,
            nearGoalReminderEnabled = true,
            goalAchievedAlertEnabled = true,
            backgroundTrackingEnabled = true,
            themeMode = "PLAID",
            distanceUnit = "FURLONGS",
            notificationsSentToday = "",
            notificationsDate = "2026-04-02",
        ).toSettings()

        assertEquals(ThemeMode.SYSTEM, settings.themeMode)
        assertEquals(DistanceUnit.KILOMETERS, settings.distanceUnit)
    }

    @Test
    fun `settings round trip through their entity`() {
        val settings = AppSettings(
            notificationsEnabled = false,
            morningReminderEnabled = false,
            nearGoalReminderEnabled = true,
            goalAchievedAlertEnabled = false,
            backgroundTrackingEnabled = false,
            themeMode = ThemeMode.DARK,
            distanceUnit = DistanceUnit.MILES,
        )

        val restored = settings.toEntity(
            notificationsSentToday = "GOAL_ACHIEVED",
            notificationsDate = "2026-04-02",
        ).toSettings()

        assertEquals(settings, restored)
    }
}
