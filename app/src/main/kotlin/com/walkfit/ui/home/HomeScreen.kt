package com.walkfit.ui.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.Route
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.walkfit.R
import com.walkfit.core.format.Formatters
import com.walkfit.core.metrics.CalorieCalculator
import com.walkfit.core.metrics.DistanceCalculator
import com.walkfit.core.model.SensorAvailability
import com.walkfit.ui.components.LoadingState
import com.walkfit.ui.components.MessageState
import com.walkfit.ui.components.ProgressRing
import com.walkfit.ui.components.RingContent
import com.walkfit.ui.components.SectionTitle
import com.walkfit.ui.components.StatRow
import com.walkfit.ui.components.StatTile
import com.walkfit.ui.components.WalkFitCard

@Composable
fun HomeScreen(
    onRequestPermission: () -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: HomeViewModel = viewModel(factory = HomeViewModel.Factory),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val sessionElapsed by viewModel.sessionElapsedMillis.collectAsStateWithLifecycle()

    // Re-check the sensor and permission every time the screen resumes, so
    // granting the permission in system settings takes effect on return.
    LifecycleResumeEffect(Unit) {
        viewModel.refreshSensorState()
        onPauseOrDispose { }
    }

    when {
        state.isLoading -> LoadingState(modifier)

        // Never render a dashboard of zeroes as if it were data: say why.
        state.sensorAvailability == SensorAvailability.UNSUPPORTED -> MessageState(
            title = stringResource(R.string.sensor_unsupported_title),
            message = stringResource(R.string.sensor_unsupported_message),
            modifier = modifier.fillMaxSize().verticalScroll(rememberScrollState()),
            secondaryActionLabel = stringResource(R.string.action_open_settings),
            onSecondaryAction = onOpenSettings,
        )

        state.sensorAvailability == SensorAvailability.PERMISSION_REQUIRED -> MessageState(
            title = stringResource(R.string.permission_required_title),
            message = stringResource(R.string.permission_required_message),
            modifier = modifier.fillMaxSize().verticalScroll(rememberScrollState()),
            primaryActionLabel = stringResource(R.string.action_grant_permission),
            onPrimaryAction = onRequestPermission,
            secondaryActionLabel = stringResource(R.string.action_open_settings),
            onSecondaryAction = onOpenSettings,
        )

        else -> DashboardContent(
            state = state,
            sessionElapsedMillis = sessionElapsed,
            onStartSession = viewModel::startSession,
            onPauseSession = viewModel::pauseSession,
            onResumeSession = viewModel::resumeSession,
            onStopSession = viewModel::stopSession,
            onDismissError = viewModel::dismissError,
            modifier = modifier,
        )
    }
}

@Composable
private fun DashboardContent(
    state: HomeUiState,
    sessionElapsedMillis: Long,
    onStartSession: () -> Unit,
    onPauseSession: () -> Unit,
    onResumeSession: () -> Unit,
    onStopSession: () -> Unit,
    onDismissError: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val unit = state.settings.distanceUnit

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        AnimatedVisibility(visible = state.errorMessage != null) {
            WalkFitCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = state.errorMessage.orEmpty(),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f),
                    )
                    TextButton(onClick = onDismissError) {
                        Text(stringResource(R.string.action_dismiss))
                    }
                }
            }
        }

        ProgressRing(
            progress = state.progress.fraction,
            contentDescription = stringResource(
                R.string.dashboard_ring_description,
                Formatters.steps(state.steps),
                state.progress.percent,
                Formatters.steps(state.goal.toLong()),
            ),
        ) {
            RingContent(
                label = stringResource(R.string.dashboard_today).uppercase(),
                value = Formatters.steps(state.steps),
                unit = stringResource(R.string.unit_steps),
                caption = stringResource(R.string.dashboard_percent_complete, state.progress.percent),
            )
        }

        Text(
            text = stringResource(R.string.dashboard_goal, Formatters.steps(state.goal.toLong())),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        StatRow {
            StatTile(
                icon = Icons.Filled.Route,
                label = stringResource(R.string.stat_distance),
                value = Formatters.distance(state.distanceMeters, unit),
                tint = MaterialTheme.colorScheme.secondary,
                isEstimate = true,
                modifier = Modifier.weight(1f),
            )
            StatTile(
                icon = Icons.Filled.LocalFireDepartment,
                label = stringResource(R.string.stat_calories),
                value = Formatters.calories(state.calories),
                tint = MaterialTheme.colorScheme.tertiary,
                isEstimate = true,
                modifier = Modifier.weight(1f),
            )
            StatTile(
                icon = Icons.Filled.Schedule,
                label = stringResource(R.string.stat_time),
                value = Formatters.duration(state.activeMillis),
                modifier = Modifier.weight(1f),
            )
        }

        Text(
            text = stringResource(R.string.estimate_disclaimer),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        SessionCard(
            state = state,
            elapsedMillis = sessionElapsedMillis,
            onStart = onStartSession,
            onPause = onPauseSession,
            onResume = onResumeSession,
            onStop = onStopSession,
        )

        WalkFitCard(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.fillMaxWidth().padding(20.dp)) {
                SectionTitle(stringResource(R.string.section_your_progress))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    SummaryFigure(
                        value = state.stats.currentStreak.toString(),
                        label = stringResource(R.string.stat_current_streak),
                    )
                    SummaryFigure(
                        value = Formatters.steps(state.stats.averageDailySteps),
                        label = stringResource(R.string.stat_daily_average),
                    )
                    SummaryFigure(
                        value = state.stats.goalsCompleted.toString(),
                        label = stringResource(R.string.stat_goals_hit),
                    )
                }
            }
        }

        if (!state.hasAnyHistory) {
            Text(
                text = stringResource(R.string.dashboard_empty_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun SummaryFigure(value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

@Composable
private fun SessionCard(
    state: HomeUiState,
    elapsedMillis: Long,
    onStart: () -> Unit,
    onPause: () -> Unit,
    onResume: () -> Unit,
    onStop: () -> Unit,
) {
    val session = state.activeSession

    WalkFitCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SectionTitle(stringResource(R.string.section_walking_session))

            if (session == null) {
                Text(
                    text = stringResource(R.string.session_idle_hint),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Button(onClick = onStart, modifier = Modifier.fillMaxWidth()) {
                    Icon(
                        imageVector = Icons.Filled.Route,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.action_start_walking))
                }
            } else {
                Text(
                    text = Formatters.timer(elapsedMillis),
                    style = MaterialTheme.typography.displayLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                ) {
                    SummaryFigure(
                        value = Formatters.steps(session.steps),
                        label = stringResource(R.string.unit_steps),
                    )
                    SummaryFigure(
                        value = Formatters.distance(
                            DistanceCalculator.distanceMeters(session.steps, state.profile),
                            state.settings.distanceUnit,
                        ),
                        label = stringResource(R.string.stat_distance),
                    )
                    SummaryFigure(
                        value = Formatters.calories(
                            CalorieCalculator.estimateCaloriesForSteps(
                                steps = session.steps,
                                profile = state.profile,
                                durationMillis = elapsedMillis,
                            ),
                        ),
                        label = stringResource(R.string.stat_calories),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    OutlinedButton(
                        onClick = if (session.isPaused) onResume else onPause,
                        modifier = Modifier.weight(1f),
                    ) {
                        Text(
                            stringResource(
                                if (session.isPaused) R.string.action_resume else R.string.action_pause,
                            ),
                        )
                    }
                    Button(onClick = onStop, modifier = Modifier.weight(1f)) {
                        Text(stringResource(R.string.action_finish))
                    }
                }
            }
        }
    }
}
