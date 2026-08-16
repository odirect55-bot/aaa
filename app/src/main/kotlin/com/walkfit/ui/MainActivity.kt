package com.walkfit.ui

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import com.walkfit.WalkFitApplication
import com.walkfit.core.model.AppSettings
import com.walkfit.core.model.SensorAvailability
import com.walkfit.di.AppContainer
import com.walkfit.service.StepTrackingService
import com.walkfit.ui.theme.WalkFitTheme
import com.walkfit.work.WalkFitScheduler
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * Single Activity host.
 *
 * Its only responsibilities are permission flow, theme, and telling the
 * tracking service whether the UI is visible (which switches the sensor
 * between live and batched delivery).
 */
class MainActivity : ComponentActivity() {

    private lateinit var container: AppContainer

    private val activityRecognitionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            // Take a reading straight away so the dashboard is not empty while
            // waiting for the first batched delivery.
            WalkFitScheduler.enqueueImmediateSync(this)
            startTrackingIfPossible()
        }
        // A denial is not an error: the dashboard renders an explanation with a
        // link into system settings, and no step data is fabricated.
        maybeRequestNotificationPermission()
    }

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* Optional: nudges are simply not shown if declined. */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        container = (application as WalkFitApplication).container

        val settingsFlow = container.settingsRepository.settings.stateIn(
            scope = lifecycleScope,
            started = SharingStarted.Eagerly,
            initialValue = AppSettings.DEFAULT,
        )

        setContent {
            val settings by settingsFlow.collectAsState()
            WalkFitTheme(themeMode = settings.themeMode) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    WalkFitApp(
                        onRequestPermission = ::requestActivityRecognitionPermission,
                        onOpenSettings = ::openAppSettings,
                    )
                }
            }
        }

        requestPermissionsIfNeeded()
    }

    override fun onStart() {
        super.onStart()
        startTrackingIfPossible()
    }

    override fun onStop() {
        super.onStop()
        // The service switches itself to batched delivery when the process goes
        // to the background; the only decision left here is whether the user
        // wants tracking to continue at all.
        lifecycleScope.launch {
            if (!container.settingsRepository.currentSettings().backgroundTrackingEnabled) {
                StepTrackingService.stop(this@MainActivity)
                // The hourly WorkManager sync still keeps the daily total
                // correct, because the hardware counter never stops counting.
                WalkFitScheduler.schedulePeriodicSync(this@MainActivity)
            }
        }
    }

    private fun requestPermissionsIfNeeded() {
        when (container.sensorController.availability()) {
            SensorAvailability.PERMISSION_REQUIRED -> requestActivityRecognitionPermission()
            SensorAvailability.AVAILABLE -> maybeRequestNotificationPermission()
            SensorAvailability.UNSUPPORTED -> Unit // Nothing to ask for.
        }
    }

    private fun requestActivityRecognitionPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        activityRecognitionLauncher.launch(Manifest.permission.ACTIVITY_RECOGNITION)
    }

    private fun maybeRequestNotificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        if (container.notificationHelper.canPostNotifications()) return
        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun startTrackingIfPossible() {
        if (container.sensorController.availability() != SensorAvailability.AVAILABLE) return
        StepTrackingService.start(this)
    }

    /** Deep link into the app's system settings so a denial is recoverable. */
    private fun openAppSettings() {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", packageName, null)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        runCatching { startActivity(intent) }
    }
}
