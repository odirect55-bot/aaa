package com.walkfit.core.model

/** Follow-system / always-light / always-dark. */
enum class ThemeMode {
    SYSTEM,
    LIGHT,
    DARK,
}

enum class DistanceUnit {
    KILOMETERS,
    MILES,
}

/** User-controlled app behaviour. All notifications can be turned off. */
data class AppSettings(
    val notificationsEnabled: Boolean = true,
    val morningReminderEnabled: Boolean = true,
    val nearGoalReminderEnabled: Boolean = true,
    val goalAchievedAlertEnabled: Boolean = true,
    val backgroundTrackingEnabled: Boolean = true,
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val distanceUnit: DistanceUnit = DistanceUnit.KILOMETERS,
) {
    companion object {
        val DEFAULT: AppSettings = AppSettings()
    }
}
