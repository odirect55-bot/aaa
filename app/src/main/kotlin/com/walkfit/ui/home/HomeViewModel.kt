package com.walkfit.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.walkfit.core.goals.GoalCalculator
import com.walkfit.core.goals.GoalProgress
import com.walkfit.core.model.ActiveSession
import com.walkfit.core.model.AppSettings
import com.walkfit.core.model.SensorAvailability
import com.walkfit.core.model.UserProfile
import com.walkfit.core.stats.StatsCalculator
import com.walkfit.core.stats.WalkingStats
import com.walkfit.di.AppContainer
import com.walkfit.ui.walkFitContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

data class HomeUiState(
    val isLoading: Boolean = true,
    val sensorAvailability: SensorAvailability = SensorAvailability.AVAILABLE,
    val steps: Long = 0L,
    val goal: Int = UserProfile.DEFAULT_DAILY_GOAL,
    val progress: GoalProgress = GoalCalculator.progress(0L, UserProfile.DEFAULT_DAILY_GOAL),
    val distanceMeters: Double = 0.0,
    val calories: Double = 0.0,
    val activeMillis: Long = 0L,
    val stats: WalkingStats = WalkingStats.EMPTY,
    val profile: UserProfile = UserProfile.EMPTY,
    val settings: AppSettings = AppSettings.DEFAULT,
    val activeSession: ActiveSession? = null,
    val hasAnyHistory: Boolean = false,
    val errorMessage: String? = null,
)

class HomeViewModel(private val container: AppContainer) : ViewModel() {

    /**
     * Re-read on resume and after a permission result, so the dashboard reacts
     * to the user granting or revoking Activity Recognition in Settings
     * without needing a restart.
     */
    private val sensorAvailability = MutableStateFlow(container.sensorController.availability())

    /**
     * The calendar day the dashboard is showing. Polled rather than assumed, so
     * a screen left open overnight rolls over on its own.
     */
    private val currentDate = MutableStateFlow(container.time.today())

    private val _errorMessage = MutableStateFlow<String?>(null)

    val uiState: StateFlow<HomeUiState> = combine(
        container.stepRepository.observeAll(),
        container.profileRepository.profile,
        container.settingsRepository.settings,
        container.sessionController.activeSession,
        combine(sensorAvailability, currentDate, _errorMessage) { availability, date, error ->
            Triple(availability, date, error)
        },
    ) { records, profile, settings, session, (availability, date, error) ->
        val today = records.firstOrNull { it.date == date }
        val goal = profile.dailyStepGoal
        val steps = today?.steps ?: 0L

        HomeUiState(
            isLoading = false,
            sensorAvailability = availability,
            steps = steps,
            goal = goal,
            progress = GoalCalculator.progress(steps, goal),
            distanceMeters = today?.distanceMeters ?: 0.0,
            calories = today?.calories ?: 0.0,
            activeMillis = today?.activeMillis ?: 0L,
            stats = StatsCalculator.compute(records, date),
            profile = profile,
            settings = settings,
            activeSession = session,
            hasAnyHistory = records.isNotEmpty(),
            errorMessage = error,
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = HomeUiState(),
    )

    /**
     * Ticks once a second, but only feeds the session card, so the rest of the
     * dashboard is not recomposed on every tick.
     */
    val sessionElapsedMillis: StateFlow<Long> = flow {
        while (true) {
            emit(container.time.nowMillis())
            delay(1_000L)
        }
    }.combine(container.sessionController.activeSession) { now, session ->
        session?.durationMillis(now) ?: 0L
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = 0L,
    )

    init {
        // Cheap midnight watchdog: one comparison a minute.
        viewModelScope.launch {
            while (true) {
                delay(60_000L)
                val today = container.time.today()
                if (today != currentDate.value) {
                    currentDate.value = today
                    container.stepRepository.rolloverIfNeeded()
                }
            }
        }
    }

    fun refreshSensorState() {
        sensorAvailability.value = container.sensorController.availability()
        currentDate.value = container.time.today()
        container.sensorController.requestFlush()
    }

    fun startSession() {
        viewModelScope.launch {
            val reading = container.sensorController.readings.replayCache.lastOrNull()
            if (reading == null) {
                _errorMessage.value = "Waiting for the step sensor. Try again in a moment."
                container.sensorController.requestFlush()
                return@launch
            }
            _errorMessage.value = null
            container.sessionController.start(reading)
        }
    }

    fun pauseSession() = viewModelScope.launch { container.sessionController.pause() }

    fun resumeSession() = viewModelScope.launch { container.sessionController.resume() }

    fun stopSession() = viewModelScope.launch { container.sessionController.stop() }

    fun dismissError() {
        _errorMessage.value = null
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                HomeViewModel(walkFitContainer())
            }
        }
    }
}
