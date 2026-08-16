package com.walkfit.ui.profile

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
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.walkfit.R
import com.walkfit.core.format.Formatters
import com.walkfit.core.model.AppSettings
import com.walkfit.core.model.DistanceUnit
import com.walkfit.core.model.SensorAvailability
import com.walkfit.core.model.Sex
import com.walkfit.core.model.ThemeMode
import com.walkfit.core.model.UserProfile
import com.walkfit.ui.components.LoadingState
import com.walkfit.ui.components.SectionTitle
import com.walkfit.ui.components.WalkFitCard

@Composable
fun ProfileScreen(
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ProfileViewModel = viewModel(factory = ProfileViewModel.Factory),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    LifecycleResumeEffect(Unit) {
        viewModel.refreshSensorState()
        onPauseOrDispose { }
    }

    if (state.isLoading) {
        LoadingState(modifier)
        return
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        ProfileForm(
            profile = state.profile,
            effectiveStrideCm = state.effectiveStrideCm,
            strideIsEstimated = state.strideIsEstimated,
            savedMessage = state.savedMessage,
            onSave = viewModel::saveProfile,
            onMessageShown = viewModel::clearSavedMessage,
        )

        SettingsSection(
            settings = state.settings,
            onSettingsChange = viewModel::updateSettings,
        )

        SensorSection(
            availability = state.sensorAvailability,
            hasStepDetector = state.hasStepDetector,
            onOpenSettings = onOpenSettings,
        )

        WalkFitCard(modifier = Modifier.fillMaxWidth()) {
            Column(
                modifier = Modifier.fillMaxWidth().padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SectionTitle(stringResource(R.string.profile_lifetime_title))
                LabelledValue(
                    stringResource(R.string.stat_total_steps),
                    Formatters.steps(state.stats.totalSteps),
                )
                LabelledValue(
                    stringResource(R.string.stat_total_distance),
                    Formatters.distance(state.stats.totalDistanceMeters, state.settings.distanceUnit),
                )
                LabelledValue(
                    stringResource(R.string.stat_days_tracked),
                    state.stats.daysTracked.toString(),
                )
                LabelledValue(
                    stringResource(R.string.stat_best_day),
                    Formatters.steps(state.stats.bestDaySteps),
                )
                Text(
                    text = stringResource(R.string.privacy_note),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ProfileForm(
    profile: UserProfile,
    effectiveStrideCm: Double,
    strideIsEstimated: Boolean,
    savedMessage: String?,
    onSave: (UserProfile) -> Unit,
    onMessageShown: () -> Unit,
) {
    var name by remember(profile) { mutableStateOf(profile.name) }
    var age by remember(profile) { mutableStateOf(profile.ageYears?.toString().orEmpty()) }
    var weight by remember(profile) { mutableStateOf(profile.weightKg?.toString().orEmpty()) }
    var height by remember(profile) { mutableStateOf(profile.heightCm?.toString().orEmpty()) }
    var stride by remember(profile) { mutableStateOf(profile.strideLengthCm?.toString().orEmpty()) }
    var sex by remember(profile) { mutableStateOf(profile.sex) }

    LaunchedEffect(savedMessage) {
        if (savedMessage != null) {
            kotlinx.coroutines.delay(2_000)
            onMessageShown()
        }
    }

    WalkFitCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SectionTitle(stringResource(R.string.profile_title))

            OutlinedTextField(
                value = name,
                onValueChange = { name = it.take(40) },
                label = { Text(stringResource(R.string.profile_name)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                NumberField(
                    value = age,
                    onValueChange = { age = it },
                    label = stringResource(R.string.profile_age),
                    modifier = Modifier.weight(1f),
                    allowDecimal = false,
                )
                NumberField(
                    value = weight,
                    onValueChange = { weight = it },
                    label = stringResource(R.string.profile_weight),
                    modifier = Modifier.weight(1f),
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                NumberField(
                    value = height,
                    onValueChange = { height = it },
                    label = stringResource(R.string.profile_height),
                    modifier = Modifier.weight(1f),
                )
                NumberField(
                    value = stride,
                    onValueChange = { stride = it },
                    label = stringResource(R.string.profile_stride),
                    modifier = Modifier.weight(1f),
                )
            }

            Text(
                text = stringResource(R.string.profile_sex_label),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Sex.entries.forEach { option ->
                    FilterChip(
                        selected = sex == option,
                        onClick = { sex = option },
                        label = { Text(stringResource(option.labelRes())) },
                    )
                }
            }

            Text(
                text = if (strideIsEstimated) {
                    stringResource(R.string.profile_stride_estimated, effectiveStrideCm.toInt())
                } else {
                    stringResource(R.string.profile_stride_configured, effectiveStrideCm.toInt())
                },
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Button(
                onClick = {
                    onSave(
                        profile.copy(
                            name = name.trim(),
                            ageYears = age.toIntOrNull(),
                            weightKg = weight.toDoubleOrNull(),
                            heightCm = height.toDoubleOrNull(),
                            strideLengthCm = stride.toDoubleOrNull(),
                            sex = sex,
                        ),
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(stringResource(R.string.action_save))
            }

            if (savedMessage != null) {
                Text(
                    text = savedMessage,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

@Composable
private fun NumberField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    allowDecimal: Boolean = true,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { input ->
            val filtered = input.filter { it.isDigit() || (allowDecimal && it == '.') }
            // At most one decimal point, and a sane length.
            if (filtered.count { it == '.' } <= 1) onValueChange(filtered.take(6))
        },
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(
            keyboardType = if (allowDecimal) KeyboardType.Decimal else KeyboardType.Number,
        ),
        modifier = modifier,
    )
}

@Composable
private fun SettingsSection(
    settings: AppSettings,
    onSettingsChange: (AppSettings) -> Unit,
) {
    WalkFitCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            SectionTitle(stringResource(R.string.settings_title))

            SettingSwitch(
                label = stringResource(R.string.settings_background_tracking),
                description = stringResource(R.string.settings_background_tracking_description),
                checked = settings.backgroundTrackingEnabled,
                onCheckedChange = {
                    onSettingsChange(settings.copy(backgroundTrackingEnabled = it))
                },
            )
            SettingSwitch(
                label = stringResource(R.string.settings_notifications),
                description = stringResource(R.string.settings_notifications_description),
                checked = settings.notificationsEnabled,
                onCheckedChange = { onSettingsChange(settings.copy(notificationsEnabled = it)) },
            )
            SettingSwitch(
                label = stringResource(R.string.settings_morning_reminder),
                checked = settings.morningReminderEnabled,
                enabled = settings.notificationsEnabled,
                onCheckedChange = { onSettingsChange(settings.copy(morningReminderEnabled = it)) },
            )
            SettingSwitch(
                label = stringResource(R.string.settings_near_goal),
                checked = settings.nearGoalReminderEnabled,
                enabled = settings.notificationsEnabled,
                onCheckedChange = { onSettingsChange(settings.copy(nearGoalReminderEnabled = it)) },
            )
            SettingSwitch(
                label = stringResource(R.string.settings_goal_achieved),
                checked = settings.goalAchievedAlertEnabled,
                enabled = settings.notificationsEnabled,
                onCheckedChange = { onSettingsChange(settings.copy(goalAchievedAlertEnabled = it)) },
            )

            Text(
                text = stringResource(R.string.settings_theme),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                ThemeMode.entries.forEach { mode ->
                    FilterChip(
                        selected = settings.themeMode == mode,
                        onClick = { onSettingsChange(settings.copy(themeMode = mode)) },
                        label = { Text(stringResource(mode.labelRes())) },
                    )
                }
            }

            Text(
                text = stringResource(R.string.settings_units),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                DistanceUnit.entries.forEach { unit ->
                    FilterChip(
                        selected = settings.distanceUnit == unit,
                        onClick = { onSettingsChange(settings.copy(distanceUnit = unit)) },
                        label = { Text(stringResource(unit.labelRes())) },
                    )
                }
            }
        }
    }
}

@Composable
private fun SensorSection(
    availability: SensorAvailability,
    hasStepDetector: Boolean,
    onOpenSettings: () -> Unit,
) {
    WalkFitCard(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            SectionTitle(stringResource(R.string.sensor_status_title))
            LabelledValue(
                stringResource(R.string.sensor_step_counter),
                stringResource(
                    when (availability) {
                        SensorAvailability.AVAILABLE -> R.string.sensor_state_active
                        SensorAvailability.UNSUPPORTED -> R.string.sensor_state_unsupported
                        SensorAvailability.PERMISSION_REQUIRED -> R.string.sensor_state_permission
                    },
                ),
            )
            LabelledValue(
                stringResource(R.string.sensor_step_detector),
                stringResource(
                    if (hasStepDetector) R.string.sensor_state_present else R.string.sensor_state_absent,
                ),
            )
            if (availability != SensorAvailability.AVAILABLE) {
                Button(onClick = onOpenSettings) {
                    Text(stringResource(R.string.action_open_settings))
                }
            }
            Text(
                text = stringResource(R.string.accuracy_note),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun SettingSwitch(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    description: String? = null,
    enabled: Boolean = true,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = if (enabled) {
                    MaterialTheme.colorScheme.onSurface
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                },
            )
            if (description != null) {
                Text(
                    text = description,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange, enabled = enabled)
    }
}

@Composable
private fun LabelledValue(label: String, value: String) {
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

private fun Sex.labelRes(): Int = when (this) {
    Sex.MALE -> R.string.sex_male
    Sex.FEMALE -> R.string.sex_female
    Sex.UNSPECIFIED -> R.string.sex_unspecified
}

private fun ThemeMode.labelRes(): Int = when (this) {
    ThemeMode.SYSTEM -> R.string.theme_system
    ThemeMode.LIGHT -> R.string.theme_light
    ThemeMode.DARK -> R.string.theme_dark
}

private fun DistanceUnit.labelRes(): Int = when (this) {
    DistanceUnit.KILOMETERS -> R.string.unit_kilometers
    DistanceUnit.MILES -> R.string.unit_miles
}
