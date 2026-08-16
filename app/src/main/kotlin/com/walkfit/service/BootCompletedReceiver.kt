package com.walkfit.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.walkfit.work.WalkFitScheduler

/**
 * After a reboot the hardware counter restarts at zero, so the app has to
 * re-baseline before the user opens it — otherwise the first reading of the
 * day would look like a counter reset much later.
 *
 * Newer Android versions restrict which foreground services may be started
 * from `BOOT_COMPLETED`, so this does not depend on the service starting: it
 * enqueues a sync worker (which takes a single reading and re-baselines) and
 * *attempts* the service, tolerating a refusal.
 */
class BootCompletedReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) {
            return
        }

        val appContext = context.applicationContext

        // Always safe: runs under WorkManager's own constraints.
        WalkFitScheduler.enqueueImmediateSync(appContext)
        WalkFitScheduler.scheduleAll(appContext)

        // Best effort; StepTrackingService.start swallows a refusal.
        StepTrackingService.start(appContext)
    }
}
