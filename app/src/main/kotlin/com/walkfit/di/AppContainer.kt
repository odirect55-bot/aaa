package com.walkfit.di

import android.content.Context
import com.walkfit.data.local.WalkFitDatabase
import com.walkfit.data.repository.ProfileRepository
import com.walkfit.data.repository.SessionRepository
import com.walkfit.data.repository.SettingsRepository
import com.walkfit.data.repository.StepRepository
import com.walkfit.data.util.SystemTimeProvider
import com.walkfit.data.util.TimeProvider
import com.walkfit.notifications.NotificationHelper
import com.walkfit.sensor.StepSensorController
import com.walkfit.session.ActiveSessionStore
import com.walkfit.session.WalkingSessionController

/**
 * Manual dependency container.
 *
 * The app has a single object graph with no scoping beyond "application", so a
 * container is enough — it keeps the build free of annotation processors beyond
 * Room and makes the wiring obvious in one file.
 */
class AppContainer(context: Context) {

    private val appContext: Context = context.applicationContext

    val time: TimeProvider = SystemTimeProvider()

    private val database: WalkFitDatabase = WalkFitDatabase.getInstance(appContext)

    val profileRepository: ProfileRepository = ProfileRepository(
        userProfileDao = database.userProfileDao(),
        goalDao = database.goalDao(),
        time = time,
    )

    val stepRepository: StepRepository = StepRepository(
        dailyStepsDao = database.dailyStepsDao(),
        profileRepository = profileRepository,
        time = time,
    )

    val sessionRepository: SessionRepository = SessionRepository(
        dao = database.walkingSessionDao(),
        time = time,
    )

    val settingsRepository: SettingsRepository = SettingsRepository(
        dao = database.appSettingsDao(),
        time = time,
    )

    val sensorController: StepSensorController = StepSensorController(appContext)

    val notificationHelper: NotificationHelper = NotificationHelper(appContext)

    val sessionController: WalkingSessionController = WalkingSessionController(
        store = ActiveSessionStore(appContext),
        sessionRepository = sessionRepository,
        profileRepository = profileRepository,
        time = time,
    )
}
