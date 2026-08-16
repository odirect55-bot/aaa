package com.walkfit.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One row per calendar day.
 *
 * The sensor bookkeeping columns live here, next to the day they describe, so
 * that reopening the app on a new day cannot mistake yesterday's baseline for
 * today's.
 */
@Entity(tableName = "daily_steps")
data class DailyStepsEntity(
    /** ISO-8601 date (`yyyy-MM-dd`); one row per day, so it is the key. */
    @PrimaryKey val date: String,
    val steps: Long,
    val goal: Int,
    val distanceMeters: Double,
    val calories: Double,
    /** Raw counter value at the start of the current sensor segment. */
    val sensorBaseline: Long,
    /** Most recent raw counter value seen. */
    val sensorLastValue: Long,
    /** Steps banked from earlier segments today (before a reboot/reset). */
    val carriedSteps: Long,
    /** Boot time the current segment belongs to; a change means a reboot. */
    val bootTimestamp: Long,
    /** Measured walking time for the day, in milliseconds. */
    val activeMillis: Long,
    /** When the counter last moved, used to measure active time. */
    val lastStepMillis: Long?,
    val createdAt: Long,
    val updatedAt: Long,
)

@Entity(tableName = "walking_sessions")
data class WalkingSessionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0L,
    val startTime: Long,
    val endTime: Long,
    val duration: Long,
    val steps: Long,
    val distanceMeters: Double,
    val calories: Double,
    /** ISO date the session started on, so history can group by day. */
    val date: String,
)

/** Single-row table; [id] is always [SINGLETON_ID]. */
@Entity(tableName = "user_profile")
data class UserProfileEntity(
    @PrimaryKey val id: Int = SINGLETON_ID,
    val name: String,
    val ageYears: Int?,
    val weightKg: Double?,
    val heightCm: Double?,
    /** Stored as the [com.walkfit.core.model.Sex] enum name. */
    val sex: String,
    val strideLengthCm: Double?,
    val updatedAt: Long,
) {
    companion object {
        const val SINGLETON_ID = 1
    }
}

/**
 * The daily goal, kept as its own table (rather than a profile column) so that
 * goal changes can be historised later without touching the profile.
 */
@Entity(tableName = "goal")
data class GoalEntity(
    @PrimaryKey val id: Int = SINGLETON_ID,
    val dailyStepGoal: Int,
    val updatedAt: Long,
) {
    companion object {
        const val SINGLETON_ID = 1
    }
}

@Entity(tableName = "app_settings")
data class AppSettingsEntity(
    @PrimaryKey val id: Int = SINGLETON_ID,
    val notificationsEnabled: Boolean,
    val morningReminderEnabled: Boolean,
    val nearGoalReminderEnabled: Boolean,
    val goalAchievedAlertEnabled: Boolean,
    val backgroundTrackingEnabled: Boolean,
    /** [com.walkfit.core.model.ThemeMode] name. */
    val themeMode: String,
    /** [com.walkfit.core.model.DistanceUnit] name. */
    val distanceUnit: String,
    /**
     * Comma-separated [com.walkfit.core.notifications.NotificationKind] names
     * already posted on [notificationsDate], so nudges are not repeated.
     */
    val notificationsSentToday: String,
    val notificationsDate: String,
) {
    companion object {
        const val SINGLETON_ID = 1
    }
}
