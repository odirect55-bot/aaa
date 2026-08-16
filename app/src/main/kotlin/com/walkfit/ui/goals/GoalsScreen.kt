package com.walkfit.ui.goals

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.walkfit.R
import com.walkfit.core.format.Formatters
import com.walkfit.core.goals.GoalCalculator
import com.walkfit.ui.components.LoadingState
import com.walkfit.ui.components.MiniProgressBar
import com.walkfit.ui.components.SectionTitle
import com.walkfit.ui.components.WalkFitCard

@Composable
fun GoalsScreen(
    modifier: Modifier = Modifier,
    viewModel: GoalsViewModel = viewModel(factory = GoalsViewModel.Factory),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    if (state.isLoading) {
        LoadingState(modifier)
        return
    }

    var customGoal by remember { mutableStateOf("") }
    val progress = GoalCalculator.progress(state.todaySteps, state.goal)

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        WalkFitCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SectionTitle(stringResource(R.string.goals_current_title))
                Text(
                    text = stringResource(
                        R.string.goals_current_value,
                        Formatters.steps(state.goal.toLong()),
                    ),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                MiniProgressBar(progress = progress.fraction)
                Text(
                    text = stringResource(
                        R.string.goals_progress_summary,
                        Formatters.steps(state.todaySteps),
                        progress.percent,
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        WalkFitCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                SectionTitle(stringResource(R.string.goals_choose_title))

                // Scrolls sideways on narrow screens instead of clipping.
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    state.presets.forEach { preset ->
                        FilterChip(
                            selected = state.goal == preset,
                            onClick = { viewModel.setGoal(preset) },
                            label = { Text(Formatters.steps(preset.toLong())) },
                        )
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    OutlinedTextField(
                        value = customGoal,
                        onValueChange = { input -> customGoal = input.filter { it.isDigit() }.take(6) },
                        label = { Text(stringResource(R.string.goals_custom_label)) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                    )
                    Button(
                        onClick = {
                            customGoal.toIntOrNull()?.let { value ->
                                viewModel.setGoal(value)
                                customGoal = ""
                            }
                        },
                        enabled = customGoal.toIntOrNull()?.let { GoalCalculator.isValidGoal(it) } == true,
                    ) {
                        Text(stringResource(R.string.action_save))
                    }
                }

                Text(
                    text = stringResource(
                        R.string.goals_custom_hint,
                        Formatters.steps(GoalCalculator.MIN_GOAL.toLong()),
                        Formatters.steps(GoalCalculator.MAX_GOAL.toLong()),
                    ),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        WalkFitCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                SectionTitle(stringResource(R.string.goals_achievements_title))
                AchievementRow(
                    label = stringResource(R.string.stat_current_streak),
                    value = stringResource(R.string.value_days, state.stats.currentStreak),
                )
                AchievementRow(
                    label = stringResource(R.string.stat_best_streak),
                    value = stringResource(R.string.value_days, state.stats.bestStreak),
                )
                AchievementRow(
                    label = stringResource(R.string.stat_goals_hit),
                    value = state.stats.goalsCompleted.toString(),
                )
                AchievementRow(
                    label = stringResource(R.string.stat_total_steps),
                    value = Formatters.steps(state.stats.totalSteps),
                )
                AchievementRow(
                    label = stringResource(R.string.stat_daily_average),
                    value = Formatters.steps(state.stats.averageDailySteps),
                )
                AchievementRow(
                    label = stringResource(R.string.stat_days_tracked),
                    value = state.stats.daysTracked.toString(),
                )
            }
        }
    }
}

@Composable
private fun AchievementRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}
