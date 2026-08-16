package com.walkfit.notifications

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.walkfit.R
import com.walkfit.core.format.Formatters
import com.walkfit.core.notifications.PlannedNotification
import com.walkfit.ui.MainActivity

/**
 * Owns every notification the app posts: the ongoing tracking notification the
 * foreground service requires, and the optional goal nudges.
 */
class NotificationHelper(private val context: Context) {

    private val manager = NotificationManagerCompat.from(context)

    fun ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val tracking = NotificationChannel(
            CHANNEL_TRACKING,
            context.getString(R.string.channel_tracking_name),
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = context.getString(R.string.channel_tracking_description)
            setShowBadge(false)
        }

        val nudges = NotificationChannel(
            CHANNEL_NUDGES,
            context.getString(R.string.channel_nudges_name),
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = context.getString(R.string.channel_nudges_description)
        }

        manager.createNotificationChannel(tracking)
        manager.createNotificationChannel(nudges)
    }

    /**
     * The ongoing notification shown while background tracking is active.
     * Android requires it; WalkFit makes it useful by showing live progress.
     */
    fun buildTrackingNotification(steps: Long, goal: Int, percent: Int): Notification {
        val contentIntent = PendingIntent.getActivity(
            context,
            REQUEST_OPEN_APP,
            Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        return NotificationCompat.Builder(context, CHANNEL_TRACKING)
            .setSmallIcon(R.drawable.ic_walk)
            .setContentTitle(
                context.getString(R.string.notification_tracking_title, Formatters.steps(steps)),
            )
            .setContentText(
                context.getString(
                    R.string.notification_tracking_text,
                    percent,
                    Formatters.steps(goal.toLong()),
                ),
            )
            .setProgress(100, percent.coerceIn(0, 100), false)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_DEFERRED)
            .build()
    }

    fun updateTrackingNotification(steps: Long, goal: Int, percent: Int) {
        if (!canPostNotifications()) return
        manager.notify(TRACKING_NOTIFICATION_ID, buildTrackingNotification(steps, goal, percent))
    }

    /** Posts a nudge. Silently does nothing if the user declined notifications. */
    fun postNudge(planned: PlannedNotification) {
        if (!canPostNotifications()) return

        val contentIntent = PendingIntent.getActivity(
            context,
            REQUEST_OPEN_APP,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_NUDGES)
            .setSmallIcon(R.drawable.ic_walk)
            .setContentTitle(planned.title)
            .setContentText(planned.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(planned.body))
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        manager.notify(planned.kind.ordinal + NUDGE_NOTIFICATION_ID_BASE, notification)
    }

    fun cancelTrackingNotification() = manager.cancel(TRACKING_NOTIFICATION_ID)

    fun canPostNotifications(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return manager.areNotificationsEnabled()
        }
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED && manager.areNotificationsEnabled()
    }

    companion object {
        const val CHANNEL_TRACKING = "walkfit_tracking"
        const val CHANNEL_NUDGES = "walkfit_nudges"
        const val TRACKING_NOTIFICATION_ID = 1001
        private const val NUDGE_NOTIFICATION_ID_BASE = 2000
        private const val REQUEST_OPEN_APP = 10
    }
}
