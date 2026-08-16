package com.walkfit

import android.app.Application
import com.walkfit.di.AppContainer
import com.walkfit.work.WalkFitScheduler

class WalkFitApplication : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        container.notificationHelper.ensureChannels()
        // Idempotent: unique work, so re-running on every launch is cheap.
        WalkFitScheduler.scheduleAll(this)
    }
}
