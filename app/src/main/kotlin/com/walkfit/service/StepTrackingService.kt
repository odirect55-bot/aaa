package com.walkfit.service

import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.util.Log
import androidx.core.app.ServiceCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.ProcessLifecycleOwner
import androidx.lifecycle.lifecycleScope
import com.walkfit.WalkFitApplication
import com.walkfit.core.goals.GoalCalculator
import com.walkfit.core.model.SensorAvailability
import com.walkfit.core.notifications.NotificationPlanner
import com.walkfit.di.AppContainer
import com.walkfit.notifications.NotificationHelper
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

/**
 * Keeps step tracking alive while the app is not on screen.
 *
 * Design notes:
 *  - Only one sensor listener exists in the app, and it lives here. The UI
 *    observes the database, so nothing double-counts.
 *  - Batching follows the *process* lifecycle, observed directly through
 *    [ProcessLifecycleOwner]: while any Activity is visible the counter is
 *    delivered immediately so the number on screen keeps up; once the app is
 *    backgrounded the sensor hub batches for minutes at a time, which is where
 *    the battery saving comes from. Watching the lifecycle here rather than
 *    having the Activity send an intent matters because Android 12+ forbids
 *    starting a foreground service from the background — an intent sent from
 *    `onStop()` can be refused, but a lifecycle callback cannot.
 *  - `START_STICKY` so Android restarts the service if it is killed for memory.
 */
class StepTrackingService : LifecycleService() {

    private lateinit var container: AppContainer
    private var liveUpdates = false
    private var listening = false

    // Cached for the notification so it can be rebuilt without a DB read.
    private var lastSteps: Long = 0L
    private var lastGoal: Int = 10_000
    private var lastPercent: Int = 0

    private val processObserver = object : DefaultLifecycleObserver {
        override fun onStart(owner: LifecycleOwner) = applyLiveUpdates(true)
        override fun onStop(owner: LifecycleOwner) = applyLiveUpdates(false)
    }

    override fun onCreate() {
        super.onCreate()
        container = (application as WalkFitApplication).container
        container.notificationHelper.ensureChannels()
        observeReadings()
        observeDetectorTicks()
        ProcessLifecycleOwner.get().lifecycle.addObserver(processObserver)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        // Always enter the foreground first. The service may have been launched
        // with startForegroundService(), and Android kills the process if
        // startForeground() is not called within a few seconds — including on
        // the paths below that decide there is nothing to track.
        promoteToForeground()

        val availability = container.sensorController.availability()
        if (availability != SensorAvailability.AVAILABLE) {
            // Nothing to track: do not sit in the foreground burning a
            // notification slot for a sensor we cannot read.
            Log.i(TAG, "Not starting tracking, sensor state = $availability")
            stopTracking()
            return START_NOT_STICKY
        }

        if (!registerSensor()) {
            Log.w(TAG, "Sensor listener could not be registered")
            stopTracking()
            return START_NOT_STICKY
        }

        lifecycleScope.launch { container.stepRepository.rolloverIfNeeded() }

        return START_STICKY
    }

    override fun onDestroy() {
        // Unregistering here is what guarantees the sensor is released on every
        // path out of the service, including a system kill.
        ProcessLifecycleOwner.get().lifecycle.removeObserver(processObserver)
        container.sensorController.stop()
        listening = false
        super.onDestroy()
    }

    /** Re-registers the listener when the app's visibility changes. */
    private fun applyLiveUpdates(live: Boolean) {
        if (liveUpdates == live) return
        liveUpdates = live
        if (!listening) return
        registerSensor()
        if (live) container.sensorController.requestFlush()
    }

    private fun registerSensor(): Boolean {
        val ok = container.sensorController.start(liveUpdates = liveUpdates)
        listening = ok
        if (ok) container.sensorController.requestFlush()
        return ok
    }

    private fun promoteToForeground() {
        val notification = container.notificationHelper.buildTrackingNotification(
            steps = lastSteps,
            goal = lastGoal,
            percent = lastPercent,
        )
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH
        } else {
            0
        }
        runCatching {
            ServiceCompat.startForeground(
                this,
                NotificationHelper.TRACKING_NOTIFICATION_ID,
                notification,
                type,
            )
        }.onFailure { error ->
            Log.e(TAG, "Could not enter the foreground", error)
        }
    }

    private fun observeReadings() {
        lifecycleScope.launch {
            container.sensorController.readings.collectLatest { reading ->
                runCatching {
                    val result = container.stepRepository.processReading(reading)
                    container.sessionController.onReading(reading)
                    refreshNotification()
                    maybeNudge(result.stepsToday)
                }.onFailure { error ->
                    Log.e(TAG, "Failed to process a sensor reading", error)
                }
            }
        }
    }

    /**
     * `TYPE_STEP_DETECTOR` fires once per step with no value attached, so it
     * can never be a source of totals. It is used purely as a hint: on devices
     * whose step counter still batches in live mode, a detected step asks the
     * sensor hub to flush, so the number on screen keeps up with the user.
     * Rate-limited so a brisk walk cannot turn into a flush per step.
     */
    private fun observeDetectorTicks() {
        lifecycleScope.launch {
            var lastFlushAt = 0L
            container.sensorController.detectorTicks.collect { at ->
                if (!liveUpdates) return@collect
                if (at - lastFlushAt < DETECTOR_FLUSH_INTERVAL_MILLIS) return@collect
                lastFlushAt = at
                container.sensorController.requestFlush()
            }
        }
    }

    private suspend fun refreshNotification() {
        val record = container.stepRepository.todayRecord() ?: return
        val progress = GoalCalculator.progress(record.steps, record.goal)
        lastSteps = record.steps
        lastGoal = record.goal
        lastPercent = progress.percent
        container.notificationHelper.updateTrackingNotification(
            steps = record.steps,
            goal = record.goal,
            percent = progress.percent,
        )
    }

    private suspend fun maybeNudge(steps: Long) {
        val settings = container.settingsRepository.currentSettings()
        val goal = container.profileRepository.currentGoal()
        val planned = NotificationPlanner.plan(
            steps = steps,
            goal = goal,
            settings = settings,
            alreadySentToday = container.settingsRepository.notificationsSentToday(),
        ) ?: return

        container.notificationHelper.postNudge(planned)
        container.settingsRepository.markNotificationSent(planned.kind)
    }

    private fun stopTracking() {
        container.sensorController.stop()
        listening = false
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    companion object {
        private const val TAG = "StepTrackingService"
        private const val DETECTOR_FLUSH_INTERVAL_MILLIS = 2_000L

        /**
         * Starts tracking. Must be called while the app is in the foreground
         * (or from an exempt context such as `BOOT_COMPLETED`); a refusal is
         * swallowed, and the periodic sync worker keeps totals correct anyway.
         */
        fun start(context: Context) {
            val intent = Intent(context, StepTrackingService::class.java)
            runCatching {
                context.startForegroundService(intent)
            }.onFailure { error ->
                Log.w(TAG, "Could not start the tracking service", error)
            }
        }

        /**
         * Stops tracking. Uses `stopService` rather than a command intent so it
         * is never subject to the background foreground-service-start
         * restriction; `onDestroy` releases the sensor.
         */
        fun stop(context: Context) {
            runCatching {
                context.stopService(Intent(context, StepTrackingService::class.java))
            }.onFailure { error ->
                Log.w(TAG, "Could not stop the tracking service", error)
            }
        }
    }
}
