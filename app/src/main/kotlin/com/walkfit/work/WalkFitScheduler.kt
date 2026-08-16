package com.walkfit.work

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.OutOfQuotaPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

/**
 * All background scheduling in one place.
 *
 * Nothing here is high frequency: the periodic sync is hourly and only takes a
 * single sensor sample, and the two daily jobs fire once each. The continuous
 * listening is done by the foreground service, which lets the sensor hub batch.
 */
object WalkFitScheduler {

    private const val WORK_PERIODIC_SYNC = "walkfit_periodic_sync"
    private const val WORK_IMMEDIATE_SYNC = "walkfit_immediate_sync"
    private const val WORK_DAILY_ROLLOVER = "walkfit_daily_rollover"
    private const val WORK_MORNING_REMINDER = "walkfit_morning_reminder"

    private val MORNING_REMINDER_TIME: LocalTime = LocalTime.of(8, 30)

    fun scheduleAll(context: Context) {
        schedulePeriodicSync(context)
        scheduleDailyRollover(context)
        scheduleMorningReminder(context)
    }

    /** Hourly top-up so totals stay right even with the service stopped. */
    fun schedulePeriodicSync(context: Context) {
        val request = PeriodicWorkRequestBuilder<StepSyncWorker>(Duration.ofHours(1))
            .setConstraints(Constraints.NONE)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_PERIODIC_SYNC,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }

    /** Used after a reboot, after a permission grant, and on app start. */
    fun enqueueImmediateSync(context: Context) {
        val request = OneTimeWorkRequestBuilder<StepSyncWorker>()
            .setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            WORK_IMMEDIATE_SYNC,
            ExistingWorkPolicy.REPLACE,
            request,
        )
    }

    fun scheduleDailyRollover(context: Context) {
        val request = PeriodicWorkRequestBuilder<DailyRolloverWorker>(Duration.ofDays(1))
            .setInitialDelay(delayUntil(LocalTime.of(0, 5)))
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_DAILY_ROLLOVER,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }

    fun scheduleMorningReminder(context: Context) {
        val request = PeriodicWorkRequestBuilder<MorningReminderWorker>(Duration.ofDays(1))
            .setInitialDelay(delayUntil(MORNING_REMINDER_TIME))
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_MORNING_REMINDER,
            ExistingPeriodicWorkPolicy.UPDATE,
            request,
        )
    }

    fun cancelMorningReminder(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_MORNING_REMINDER)
    }

    /** Time from now until the next occurrence of [target]. */
    private fun delayUntil(target: LocalTime, zone: ZoneId = ZoneId.systemDefault()): Duration {
        val now = LocalDateTime.now(zone)
        val todayAtTarget = LocalDateTime.of(LocalDate.now(zone), target)
        val next = if (todayAtTarget.isAfter(now)) todayAtTarget else todayAtTarget.plusDays(1)
        return Duration.between(now, next)
    }
}
