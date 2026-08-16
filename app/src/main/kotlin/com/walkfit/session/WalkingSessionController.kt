package com.walkfit.session

import android.content.Context
import androidx.core.content.edit
import com.walkfit.core.model.ActiveSession
import com.walkfit.core.model.CompletedSession
import com.walkfit.core.model.SensorReading
import com.walkfit.core.step.WalkingSessionEngine
import com.walkfit.data.repository.ProfileRepository
import com.walkfit.data.repository.SessionRepository
import com.walkfit.data.util.TimeProvider
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Persists the in-flight session so that a walk survives the app process being
 * killed (which is routine on Android). Small enough to belong in preferences
 * rather than the database — it is transient state, not history.
 */
class ActiveSessionStore(context: Context) {

    private val prefs = context.getSharedPreferences("walkfit_active_session", Context.MODE_PRIVATE)

    fun load(): ActiveSession? {
        if (!prefs.contains(KEY_START_TIME)) return null
        return ActiveSession(
            startTimeMillis = prefs.getLong(KEY_START_TIME, 0L),
            baselineValue = prefs.getLong(KEY_BASELINE, 0L),
            lastSensorValue = prefs.getLong(KEY_LAST_VALUE, 0L),
            carriedSteps = prefs.getLong(KEY_CARRIED, 0L),
            bootTimestampMillis = prefs.getLong(KEY_BOOT, 0L),
            lastUpdatedMillis = prefs.getLong(KEY_UPDATED, 0L),
            pausedDurationMillis = prefs.getLong(KEY_PAUSED_DURATION, 0L),
            isPaused = prefs.getBoolean(KEY_IS_PAUSED, false),
            pausedAtMillis = prefs.getLong(KEY_PAUSED_AT, -1L).takeIf { it >= 0L },
        )
    }

    fun save(session: ActiveSession) = prefs.edit {
        putLong(KEY_START_TIME, session.startTimeMillis)
        putLong(KEY_BASELINE, session.baselineValue)
        putLong(KEY_LAST_VALUE, session.lastSensorValue)
        putLong(KEY_CARRIED, session.carriedSteps)
        putLong(KEY_BOOT, session.bootTimestampMillis)
        putLong(KEY_UPDATED, session.lastUpdatedMillis)
        putLong(KEY_PAUSED_DURATION, session.pausedDurationMillis)
        putBoolean(KEY_IS_PAUSED, session.isPaused)
        putLong(KEY_PAUSED_AT, session.pausedAtMillis ?: -1L)
    }

    fun clear() = prefs.edit { clear() }

    private companion object {
        const val KEY_START_TIME = "startTime"
        const val KEY_BASELINE = "baseline"
        const val KEY_LAST_VALUE = "lastValue"
        const val KEY_CARRIED = "carried"
        const val KEY_BOOT = "boot"
        const val KEY_UPDATED = "updated"
        const val KEY_PAUSED_DURATION = "pausedDuration"
        const val KEY_IS_PAUSED = "isPaused"
        const val KEY_PAUSED_AT = "pausedAt"
    }
}

/**
 * Drives the optional "Start Walking" feature. Shared by the UI and the
 * tracking service so both see the same live session.
 */
class WalkingSessionController(
    private val store: ActiveSessionStore,
    private val sessionRepository: SessionRepository,
    private val profileRepository: ProfileRepository,
    private val time: TimeProvider,
) {

    private val mutex = Mutex()
    private val _activeSession = MutableStateFlow(store.load())

    val activeSession: StateFlow<ActiveSession?> = _activeSession.asStateFlow()

    val isRunning: Boolean get() = _activeSession.value != null

    suspend fun start(reading: SensorReading): ActiveSession = mutex.withLock {
        val session = WalkingSessionEngine.start(reading, time.nowMillis())
        store.save(session)
        _activeSession.value = session
        session
    }

    suspend fun onReading(reading: SensorReading) = mutex.withLock {
        val current = _activeSession.value ?: return@withLock
        val updated = WalkingSessionEngine.onReading(current, reading)
        store.save(updated)
        _activeSession.value = updated
    }

    suspend fun pause() = mutex.withLock {
        val current = _activeSession.value ?: return@withLock
        val updated = WalkingSessionEngine.pause(current, time.nowMillis())
        store.save(updated)
        _activeSession.value = updated
    }

    suspend fun resume() = mutex.withLock {
        val current = _activeSession.value ?: return@withLock
        val updated = WalkingSessionEngine.resume(current, time.nowMillis())
        store.save(updated)
        _activeSession.value = updated
    }

    /** Stops, saves to history, and returns the completed session. */
    suspend fun stop(): CompletedSession? = mutex.withLock {
        val current = _activeSession.value ?: return@withLock null
        val completed = WalkingSessionEngine.stop(
            session = current,
            endTimeMillis = time.nowMillis(),
            profile = profileRepository.currentProfile(),
        )
        sessionRepository.save(completed)
        store.clear()
        _activeSession.value = null
        completed
    }

    /** Abandons the session without writing it to history. */
    suspend fun discard() = mutex.withLock {
        store.clear()
        _activeSession.value = null
    }
}
