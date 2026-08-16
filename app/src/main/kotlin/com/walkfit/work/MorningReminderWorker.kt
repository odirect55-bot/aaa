package com.walkfit.work

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.walkfit.WalkFitApplication
import com.walkfit.core.notifications.NotificationPlanner

/** Posts the optional morning nudge, subject to the user's settings. */
class MorningReminderWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val container = (applicationContext as WalkFitApplication).container
        return runCatching {
            val planned = NotificationPlanner.planMorningReminder(
                goal = container.profileRepository.currentGoal(),
                settings = container.settingsRepository.currentSettings(),
                alreadySentToday = container.settingsRepository.notificationsSentToday(),
            )
            if (planned != null) {
                container.notificationHelper.postNudge(planned)
                container.settingsRepository.markNotificationSent(planned.kind)
            }
            Result.success()
        }.getOrElse { error ->
            Log.e(TAG, "Morning reminder failed", error)
            Result.success()
        }
    }

    private companion object {
        const val TAG = "MorningReminderWorker"
    }
}
