package com.walkfit.work

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.walkfit.WalkFitApplication
import com.walkfit.core.model.SensorAvailability
import com.walkfit.sensor.StepSensorController
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Safety net for the times the foreground service is not running — after a
 * reboot where Android refused to start it, or when the user turned background
 * tracking off and later reopened the app.
 *
 * This works precisely because `TYPE_STEP_COUNTER` is a hardware counter: it
 * keeps counting with nothing listening, so a single reading taken later
 * recovers every step in between. The worker registers, waits for one reading,
 * and unregisters — it never holds the sensor open.
 */
class StepSyncWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val container = (applicationContext as WalkFitApplication).container

        // Close out any day that ended while nothing was listening.
        runCatching { container.stepRepository.rolloverIfNeeded() }
            .onFailure { Log.e(TAG, "Rollover failed", it) }

        // A dedicated controller so this never disturbs the service's listener.
        val controller = StepSensorController(applicationContext)
        if (controller.availability() != SensorAvailability.AVAILABLE) {
            return Result.success()
        }

        return try {
            if (!controller.start(liveUpdates = true)) {
                return Result.success()
            }
            val reading = withTimeoutOrNull(READING_TIMEOUT_MILLIS) {
                controller.readings.first()
            }
            if (reading != null) {
                container.stepRepository.processReading(reading)
            }
            Result.success()
        } catch (error: Exception) {
            Log.e(TAG, "Step sync failed", error)
            Result.retry()
        } finally {
            controller.stop()
        }
    }

    private companion object {
        const val TAG = "StepSyncWorker"

        /**
         * The counter reports its current value on registration, so a reading
         * normally arrives immediately; this only bounds a misbehaving sensor.
         */
        const val READING_TIMEOUT_MILLIS = 20_000L
    }
}
