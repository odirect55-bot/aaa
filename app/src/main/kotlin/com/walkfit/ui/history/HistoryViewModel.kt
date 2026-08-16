package com.walkfit.ui.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.walkfit.core.history.ChartBucket
import com.walkfit.core.history.HistoryAggregator
import com.walkfit.core.model.DailyStepRecord
import com.walkfit.core.model.DistanceUnit
import com.walkfit.data.local.WalkingSessionEntity
import com.walkfit.di.AppContainer
import com.walkfit.ui.walkFitContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import java.time.LocalDate

/** Which span the History screen is showing. */
enum class HistoryRange(val label: String, val days: Int) {
    WEEK("7 days", 7),
    MONTH("30 days", 30),
    QUARTER("90 days", 90),
}

data class HistoryUiState(
    val isLoading: Boolean = true,
    val range: HistoryRange = HistoryRange.WEEK,
    val today: DailyStepRecord? = null,
    val yesterday: DailyStepRecord? = null,
    /** Oldest-first, gap-filled series for the selected range. */
    val dailySeries: List<DailyStepRecord> = emptyList(),
    /** Newest-first list for the record rows. */
    val recentDays: List<DailyStepRecord> = emptyList(),
    val weeklyBuckets: List<ChartBucket> = emptyList(),
    val monthlyBuckets: List<ChartBucket> = emptyList(),
    val sessions: List<WalkingSessionEntity> = emptyList(),
    val distanceUnit: DistanceUnit = DistanceUnit.KILOMETERS,
    val hasAnyHistory: Boolean = false,
)

class HistoryViewModel(private val container: AppContainer) : ViewModel() {

    private val _range = MutableStateFlow(HistoryRange.WEEK)

    val uiState: StateFlow<HistoryUiState> = combine(
        container.stepRepository.observeAll(),
        container.sessionRepository.observeAll(),
        container.profileRepository.goal,
        container.settingsRepository.settings,
        _range,
    ) { records, sessions, goal, settings, range ->
        val today: LocalDate = container.time.today()
        val series = HistoryAggregator.dailySeries(records, today, range.days, goal)

        HistoryUiState(
            isLoading = false,
            range = range,
            today = records.firstOrNull { it.date == today },
            yesterday = records.firstOrNull { it.date == today.minusDays(1) },
            dailySeries = series,
            recentDays = series.asReversed(),
            weeklyBuckets = HistoryAggregator.weeklySeries(records, today, WEEK_BUCKETS, goal),
            monthlyBuckets = HistoryAggregator.monthlySeries(records, today, MONTH_BUCKETS, goal),
            sessions = sessions,
            distanceUnit = settings.distanceUnit,
            hasAnyHistory = records.isNotEmpty(),
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = HistoryUiState(),
    )

    fun selectRange(range: HistoryRange) {
        _range.value = range
    }

    companion object {
        private const val WEEK_BUCKETS = 8
        private const val MONTH_BUCKETS = 6

        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer { HistoryViewModel(walkFitContainer()) }
        }
    }
}
