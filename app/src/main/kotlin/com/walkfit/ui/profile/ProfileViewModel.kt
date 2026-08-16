package com.walkfit.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.walkfit.core.metrics.StrideCalculator
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
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class ProfileUiState(
    val isLoading: Boolean = true,
    val profile: UserProfile = UserProfile.EMPTY,
    val settings: AppSettings = AppSettings.DEFAULT,
    val stats: WalkingStats = WalkingStats.EMPTY,
    val sensorAvailability: SensorAvailability = SensorAvailability.AVAILABLE,
    val hasStepDetector: Boolean = false,
    /** Stride actually in use, in centimetres — estimated unless configured. */
    val effectiveStrideCm: Double = 0.0,
    val strideIsEstimated: Boolean = true,
    val savedMessage: String? = null,
)

class ProfileViewModel(private val container: AppContainer) : ViewModel() {

    private val sensorAvailability = MutableStateFlow(container.sensorController.availability())
    private val _savedMessage = MutableStateFlow<String?>(null)

    val uiState: StateFlow<ProfileUiState> = combine(
        container.profileRepository.profile,
        container.settingsRepository.settings,
        container.stepRepository.observeAll(),
        sensorAvailability,
        _savedMessage,
    ) { profile, settings, records, availability, savedMessage ->
        ProfileUiState(
            isLoading = false,
            profile = profile,
            settings = settings,
            stats = StatsCalculator.compute(records, container.time.today()),
            sensorAvailability = availability,
            hasStepDetector = container.sensorController.hasStepDetector,
            effectiveStrideCm = StrideCalculator.strideMeters(profile) * 100.0,
            strideIsEstimated = !StrideCalculator.isUserConfigured(profile),
            savedMessage = savedMessage,
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = ProfileUiState(),
    )

    /**
     * Saves the profile and refreshes today's derived estimates. Step counts
     * are never touched by a profile change — only distance and calories,
     * which are derived from it.
     */
    fun saveProfile(profile: UserProfile) {
        viewModelScope.launch {
            container.profileRepository.saveProfile(profile)
            container.stepRepository.recomputeTodayEstimates()
            _savedMessage.value = "Profile saved"
        }
    }

    fun updateSettings(settings: AppSettings) {
        viewModelScope.launch { container.settingsRepository.updateSettings(settings) }
    }

    fun refreshSensorState() {
        sensorAvailability.value = container.sensorController.availability()
    }

    fun clearSavedMessage() {
        _savedMessage.value = null
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer { ProfileViewModel(walkFitContainer()) }
        }
    }
}
