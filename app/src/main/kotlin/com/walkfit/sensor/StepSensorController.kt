package com.walkfit.sensor

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.SystemClock
import android.util.Log
import androidx.core.content.ContextCompat
import com.walkfit.core.model.SensorAvailability
import com.walkfit.core.model.SensorReading
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * The only place in the app that talks to the hardware.
 *
 * Reads `Sensor.TYPE_STEP_COUNTER` — the cumulative counter that survives the
 * app being killed — and, when present, also listens to
 * `Sensor.TYPE_STEP_DETECTOR` purely to make the live UI feel immediate
 * between the counter's batched deliveries. The detector never contributes to
 * stored totals; every persisted number traces back to the counter.
 *
 * If no step counter exists, [availability] reports [SensorAvailability.UNSUPPORTED]
 * and no readings are ever emitted. The app has no fallback step source by
 * design: it reports the limitation instead of inventing numbers.
 */
class StepSensorController(private val context: Context) {

    private val sensorManager: SensorManager? =
        ContextCompat.getSystemService(context, SensorManager::class.java)

    private val stepCounterSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)

    private val stepDetectorSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)

    private val _readings = MutableSharedFlow<SensorReading>(
        replay = 1,
        extraBufferCapacity = 8,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    /** Raw counter readings. Cold until [start] is called. */
    val readings: SharedFlow<SensorReading> = _readings.asSharedFlow()

    private val _detectorTicks = MutableSharedFlow<Long>(
        replay = 0,
        extraBufferCapacity = 16,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )

    /** One emission per detected step, for live UI feedback only. */
    val detectorTicks: SharedFlow<Long> = _detectorTicks.asSharedFlow()

    @Volatile
    private var registered = false

    val hasStepDetector: Boolean get() = stepDetectorSensor != null

    fun hasActivityRecognitionPermission(): Boolean {
        // The runtime permission only exists from API 29.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACTIVITY_RECOGNITION,
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun availability(): SensorAvailability = when {
        stepCounterSensor == null -> SensorAvailability.UNSUPPORTED
        !hasActivityRecognitionPermission() -> SensorAvailability.PERMISSION_REQUIRED
        else -> SensorAvailability.AVAILABLE
    }

    private val counterListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            if (event.sensor?.type != Sensor.TYPE_STEP_COUNTER) return
            val raw = event.values.firstOrNull()?.toLong() ?: return
            _readings.tryEmit(
                SensorReading(
                    rawCounterValue = raw,
                    timestampMillis = System.currentTimeMillis(),
                    bootTimestampMillis = bootTimestampMillis(),
                ),
            )
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    }

    private val detectorListener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
            if (event.sensor?.type != Sensor.TYPE_STEP_DETECTOR) return
            _detectorTicks.tryEmit(System.currentTimeMillis())
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
    }

    /**
     * Registers the listeners. Safe to call repeatedly.
     *
     * @param liveUpdates when true the counter is delivered without batching
     *   and the step detector is attached as well — used while the dashboard is
     *   on screen. When false the counter is batched by up to
     *   [BATCH_LATENCY_MICROS], which lets the SoC's sensor hub buffer events
     *   and keeps the app off the CPU while the screen is off.
     * @return false if there is nothing to register (no sensor or no permission).
     */
    fun start(liveUpdates: Boolean): Boolean {
        val manager = sensorManager ?: return false
        val counter = stepCounterSensor ?: return false
        if (!hasActivityRecognitionPermission()) return false

        stop()

        val samplingPeriod = SensorManager.SENSOR_DELAY_NORMAL
        val batchLatency = if (liveUpdates) 0 else BATCH_LATENCY_MICROS
        val ok = manager.registerListener(counterListener, counter, samplingPeriod, batchLatency)
        if (!ok) {
            Log.w(TAG, "SensorManager refused to register the step counter listener")
            return false
        }

        if (liveUpdates) {
            stepDetectorSensor?.let { detector ->
                manager.registerListener(detectorListener, detector, samplingPeriod)
            }
        }

        registered = true
        return true
    }

    /** Unregisters everything. Safe to call when nothing is registered. */
    fun stop() {
        val manager = sensorManager ?: return
        if (!registered) {
            // Still attempt removal: registration may have partially succeeded.
            manager.unregisterListener(counterListener)
            manager.unregisterListener(detectorListener)
            return
        }
        manager.unregisterListener(counterListener)
        manager.unregisterListener(detectorListener)
        registered = false
    }

    /**
     * Asks the sensor hub to flush any batched events immediately, so the UI
     * can show an up-to-date number the moment it is opened.
     */
    fun requestFlush() {
        val manager = sensorManager ?: return
        if (!registered) return
        runCatching { manager.flush(counterListener) }
    }

    /**
     * Approximate wall-clock time the device booted. Derived rather than
     * stored, and the comparison in
     * [com.walkfit.core.step.StepCounterEngine] tolerates the sampling jitter
     * between the two clock reads.
     */
    fun bootTimestampMillis(): Long = System.currentTimeMillis() - SystemClock.elapsedRealtime()

    private companion object {
        const val TAG = "StepSensorController"

        /**
         * 5 minutes. Long enough for the hardware to batch aggressively (which
         * is where the battery saving comes from), short enough that the
         * notification and any goal nudge stay timely.
         */
        const val BATCH_LATENCY_MICROS = 5 * 60 * 1_000_000
    }
}
