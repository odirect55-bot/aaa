package com.walkfit.ui.history

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.walkfit.R
import com.walkfit.core.format.Formatters
import com.walkfit.core.history.ChartBucket
import com.walkfit.core.model.DailyStepRecord
import com.walkfit.core.model.DistanceUnit
import com.walkfit.data.local.WalkingSessionEntity
import com.walkfit.ui.components.BarChartEntry
import com.walkfit.ui.components.LoadingState
import com.walkfit.ui.components.MessageState
import com.walkfit.ui.components.MiniProgressBar
import com.walkfit.ui.components.SectionTitle
import com.walkfit.ui.components.StepsBarChart
import com.walkfit.ui.components.WalkFitCard
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

private val DAY_FORMATTER: DateTimeFormatter =
    DateTimeFormatter.ofPattern("EEE d MMM", Locale.getDefault())
private val TIME_FORMATTER: DateTimeFormatter =
    DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT)

@Composable
fun HistoryScreen(
    modifier: Modifier = Modifier,
    viewModel: HistoryViewModel = viewModel(factory = HistoryViewModel.Factory),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    when {
        state.isLoading -> LoadingState(modifier)

        !state.hasAnyHistory -> MessageState(
            title = stringResource(R.string.history_empty_title),
            message = stringResource(R.string.history_empty_message),
            modifier = modifier.fillMaxSize(),
        )

        else -> HistoryContent(
            state = state,
            onSelectRange = viewModel::selectRange,
            modifier = modifier,
        )
    }
}

@Composable
private fun HistoryContent(
    state: HistoryUiState,
    onSelectRange: (HistoryRange) -> Unit,
    modifier: Modifier = Modifier,
) {
    val today = LocalDate.now()

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = 20.dp,
            end = 20.dp,
            top = 16.dp,
            bottom = 24.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                HistoryRange.entries.forEach { range ->
                    FilterChip(
                        selected = state.range == range,
                        onClick = { onSelectRange(range) },
                        label = { Text(range.label) },
                        colors = FilterChipDefaults.filterChipColors(),
                    )
                }
            }
        }

        item {
            SummaryPair(today = state.today, yesterday = state.yesterday, unit = state.distanceUnit)
        }

        item {
            ChartCard(
                title = stringResource(R.string.chart_daily_steps),
                entries = state.dailySeries.map { record ->
                    BarChartEntry(
                        label = record.date.dayOfMonth.toString(),
                        value = record.steps,
                        goalReached = record.goalReached,
                    )
                },
            )
        }

        item {
            ChartCard(
                title = stringResource(R.string.chart_weekly_steps),
                entries = state.weeklyBuckets.map { it.toEntry() },
            )
        }

        item {
            ChartCard(
                title = stringResource(R.string.chart_monthly_steps),
                entries = state.monthlyBuckets.map { it.toEntry() },
            )
        }

        item { SectionTitle(stringResource(R.string.section_daily_records)) }

        items(state.recentDays, key = { it.date.toString() }) { record ->
            DayRow(record = record, today = today, unit = state.distanceUnit)
        }

        item { SectionTitle(stringResource(R.string.section_walking_sessions)) }

        if (state.sessions.isEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.sessions_empty_message),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                )
            }
        } else {
            items(state.sessions, key = { it.id }) { session ->
                SessionRow(session = session, unit = state.distanceUnit)
            }
        }
    }
}

private fun ChartBucket.toEntry() = BarChartEntry(
    label = label,
    value = steps,
    goalReached = goalReached,
)

@Composable
private fun SummaryPair(
    today: DailyStepRecord?,
    yesterday: DailyStepRecord?,
    unit: DistanceUnit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        SummaryCard(
            title = stringResource(R.string.dashboard_today),
            record = today,
            unit = unit,
            modifier = Modifier.weight(1f),
        )
        SummaryCard(
            title = stringResource(R.string.history_yesterday),
            record = yesterday,
            unit = unit,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun SummaryCard(
    title: String,
    record: DailyStepRecord?,
    unit: DistanceUnit,
    modifier: Modifier = Modifier,
) {
    WalkFitCard(modifier = modifier) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = Formatters.steps(record?.steps ?: 0L),
                style = MaterialTheme.typography.headlineSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = Formatters.distance(record?.distanceMeters ?: 0.0, unit),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            MiniProgressBar(progress = record?.progress ?: 0f)
        }
    }
}

@Composable
private fun ChartCard(title: String, entries: List<BarChartEntry>) {
    WalkFitCard(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
            SectionTitle(title)
            StepsBarChart(entries = entries)
        }
    }
}

@Composable
private fun DayRow(record: DailyStepRecord, today: LocalDate, unit: DistanceUnit) {
    val label = when (record.date) {
        today -> stringResource(R.string.dashboard_today)
        today.minusDays(1) -> stringResource(R.string.history_yesterday)
        else -> record.date.format(DAY_FORMATTER)
    }

    WalkFitCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = stringResource(
                        R.string.history_steps_of_goal,
                        Formatters.steps(record.steps),
                        Formatters.steps(record.goal.toLong()),
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            MiniProgressBar(progress = record.progress)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(
                    text = Formatters.distance(record.distanceMeters, unit),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = Formatters.calories(record.calories),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = Formatters.percent(record.completionPercent),
                    style = MaterialTheme.typography.labelMedium,
                    color = if (record.goalReached) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
            }
        }
    }
}

@Composable
private fun SessionRow(session: WalkingSessionEntity, unit: DistanceUnit) {
    val start = java.time.Instant.ofEpochMilli(session.startTime)
        .atZone(java.time.ZoneId.systemDefault())
    val end = java.time.Instant.ofEpochMilli(session.endTime)
        .atZone(java.time.ZoneId.systemDefault())

    WalkFitCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = start.toLocalDate().format(DAY_FORMATTER),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = "${start.format(TIME_FORMATTER)} – ${end.format(TIME_FORMATTER)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                Text(
                    text = "${Formatters.steps(session.steps)} ${stringResource(R.string.unit_steps)}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = Formatters.duration(session.duration),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = Formatters.distance(session.distanceMeters, unit),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = Formatters.calories(session.calories),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
