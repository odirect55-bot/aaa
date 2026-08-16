package com.walkfit.data.mapper

import com.walkfit.core.model.AppSettings
import com.walkfit.core.model.CompletedSession
import com.walkfit.core.model.DailyStepRecord
import com.walkfit.core.model.DistanceUnit
import com.walkfit.core.model.Sex
import com.walkfit.core.model.StepTrackingState
import com.walkfit.core.model.ThemeMode
import com.walkfit.core.model.UserProfile
import com.walkfit.data.local.AppSettingsEntity
import com.walkfit.data.local.DailyStepsEntity
import com.walkfit.data.local.GoalEntity
import com.walkfit.data.local.UserProfileEntity
import com.walkfit.data.local.WalkingSessionEntity
import com.walkfit.data.util.DateKeys

fun DailyStepsEntity.toRecord(): DailyStepRecord = DailyStepRecord(
    date = DateKeys.fromKey(date),
    steps = steps,
    goal = goal,
    distanceMeters = distanceMeters,
    calories = calories,
    activeMillis = activeMillis,
)

fun DailyStepsEntity.toTrackingState(): StepTrackingState = StepTrackingState(
    date = DateKeys.fromKey(date),
    baselineValue = sensorBaseline,
    lastSensorValue = sensorLastValue,
    carriedSteps = carriedSteps,
    bootTimestampMillis = bootTimestamp,
    lastUpdatedMillis = updatedAt,
)

fun UserProfileEntity.toProfile(dailyStepGoal: Int): UserProfile = UserProfile(
    name = name,
    ageYears = ageYears,
    weightKg = weightKg,
    heightCm = heightCm,
    sex = runCatching { Sex.valueOf(sex) }.getOrDefault(Sex.UNSPECIFIED),
    strideLengthCm = strideLengthCm,
    dailyStepGoal = dailyStepGoal,
)

fun UserProfile.toEntity(updatedAt: Long): UserProfileEntity = UserProfileEntity(
    id = UserProfileEntity.SINGLETON_ID,
    name = name,
    ageYears = ageYears,
    weightKg = weightKg,
    heightCm = heightCm,
    sex = sex.name,
    strideLengthCm = strideLengthCm,
    updatedAt = updatedAt,
)

fun GoalEntity.toGoal(): Int = dailyStepGoal

fun AppSettingsEntity.toSettings(): AppSettings = AppSettings(
    notificationsEnabled = notificationsEnabled,
    morningReminderEnabled = morningReminderEnabled,
    nearGoalReminderEnabled = nearGoalReminderEnabled,
    goalAchievedAlertEnabled = goalAchievedAlertEnabled,
    backgroundTrackingEnabled = backgroundTrackingEnabled,
    themeMode = runCatching { ThemeMode.valueOf(themeMode) }.getOrDefault(ThemeMode.SYSTEM),
    distanceUnit = runCatching { DistanceUnit.valueOf(distanceUnit) }
        .getOrDefault(DistanceUnit.KILOMETERS),
)

fun AppSettings.toEntity(
    notificationsSentToday: String,
    notificationsDate: String,
): AppSettingsEntity = AppSettingsEntity(
    id = AppSettingsEntity.SINGLETON_ID,
    notificationsEnabled = notificationsEnabled,
    morningReminderEnabled = morningReminderEnabled,
    nearGoalReminderEnabled = nearGoalReminderEnabled,
    goalAchievedAlertEnabled = goalAchievedAlertEnabled,
    backgroundTrackingEnabled = backgroundTrackingEnabled,
    themeMode = themeMode.name,
    distanceUnit = distanceUnit.name,
    notificationsSentToday = notificationsSentToday,
    notificationsDate = notificationsDate,
)

fun WalkingSessionEntity.toCompletedSession(): CompletedSession = CompletedSession(
    startTimeMillis = startTime,
    endTimeMillis = endTime,
    durationMillis = duration,
    steps = steps,
    distanceMeters = distanceMeters,
    calories = calories,
)
