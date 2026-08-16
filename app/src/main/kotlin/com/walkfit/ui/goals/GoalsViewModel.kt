package com.walkfit.ui.goals

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.walkfit.core.goals.GoalCalculator
import com.walkfit.core.stats.StatsCalculator
import com.walkfit.core.stats.WalkingStats
import com.walkfit.di.AppContainer
import com.walkfit.ui.walkFitContainer
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class GoalsUiState(
    val isLoading: Boolean = true,
    val goal: Int = 10_000,
    val presets: List<Int> = GoalCalculator.PRESET_GOALS,
    val todaySteps: Long = 0L,
    val stats: WalkingStats = WalkingStats.EMPTY,
)

class GoalsViewModel(private val container: AppContainer) : ViewModel() {

    val uiState: StateFlow<GoalsUiState> = combine(
        container.profileRepository.goal,
        container.stepRepository.observeAll(),
    ) { goal, records ->
        val today = container.time.today()
        GoalsUiState(
            isLoading = false,
            goal = goal,
            todaySteps = records.firstOrNull { it.date == today }?.steps ?: 0L,
            stats = StatsCalculator.compute(records, today),
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = GoalsUiState(),
    )

    /**
     * Applies the new goal to today as well, so the ring and the streak agree
     * with what the user just chose. Past days keep the goal they were walked
     * against.
     */
    fun setGoal(goal: Int) {
        viewModelScope.launch {
            val sanitized = GoalCalculator.sanitizeGoal(goal)
            container.profileRepository.setGoal(sanitized)
            container.stepRepository.applyGoalToToday(sanitized)
        }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer { GoalsViewModel(walkFitContainer()) }
        }
    }
}
