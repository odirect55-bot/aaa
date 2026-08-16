package com.walkfit.data.repository

import com.walkfit.core.metrics.CalorieCalculator
import com.walkfit.core.metrics.DistanceCalculator
import com.walkfit.core.model.DailyStepRecord
import com.walkfit.core.model.SensorReading
import com.walkfit.core.model.StepTrackingState
import com.walkfit.core.model.StepUpdateResult
import com.walkfit.core.model.UserProfile
import com.walkfit.core.step.ActiveTimeTracker
import com.walkfit.core.step.StepCounterEngine
import com.walkfit.data.local.DailyStepsDao
import com.walkfit.data.local.DailyStepsEntity
import com.walkfit.data.mapper.toRecord
import com.walkfit.data.mapper.toTrackingState
import com.walkfit.data.util.DateKeys
import com.walkfit.data.util.TimeProvider
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Owns the persisted step history and the sensor bookkeeping behind it.
 *
 * All of the arithmetic lives in [StepCounterEngine]; this class is the part
 * that reads and writes rows. A [Mutex] serialises updates because readings can
 * arrive from the foreground service while the UI is also triggering a refresh.
 */
class StepRepository(
    private val dailyStepsDao: DailyStepsDao,
    private val profileRepository: ProfileRepository,
    private val time: TimeProvider,
) {

    private val mutex = Mutex()

    fun observeAll(): Flow<List<DailyStepRecord>> =
        dailyStepsDao.observeAll().map { rows -> rows.map { it.toRecord() } }

    suspend fun todayRecord(): DailyStepRecord? =
        dailyStepsDao.getByDate(DateKeys.toKey(time.today()))?.toRecord()

    /**
     * Applies one hardware reading: rolls the day over if needed, updates
     * today's totals, and returns what happened so callers can react (post a
     * notification, refresh the service notification, ...).
     */
    suspend fun processReading(reading: SensorReading): StepUpdateResult = mutex.withLock {
        val today = time.today()
        val profile = profileRepository.currentProfile()
        val now = reading.timestampMillis

        val previousEntity = dailyStepsDao.getMostRecent()
        val previousState = previousEntity?.toTrackingState()
        val result = StepCounterEngine.onReading(previousState, reading, today)

        result.finalizedDay?.let { finalized ->
            val row = dailyStepsDao.getByDate(DateKeys.toKey(finalized.date)) ?: previousEntity
            if (row != null) {
                dailyStepsDao.upsert(
                    row.copy(
                        steps = finalized.steps,
                        distanceMeters = DistanceCalculator.distanceMeters(finalized.steps, profile),
                        calories = CalorieCalculator.estimateCaloriesForSteps(
                            steps = finalized.steps,
                            profile = profile,
                            durationMillis = row.activeMillis,
                        ),
                        updatedAt = now,
                    ),
                )
            }
        }

        val state = result.state
        val dateKey = DateKeys.toKey(state.date)
        val existing = dailyStepsDao.getByDate(dateKey)

        // Active time only advances when the counter moved within the same day.
        val sameDayAsBefore = previousEntity?.date == dateKey
        val stepsDelta = if (sameDayAsBefore) {
            (state.stepsToday - (previousEntity?.steps ?: 0L)).coerceAtLeast(0L)
        } else {
            0L
        }
        val activeUpdate = ActiveTimeTracker.onStepIncrement(
            activeMillis = existing?.activeMillis ?: 0L,
            lastStepMillis = existing?.lastStepMillis,
            nowMillis = now,
            stepsDelta = stepsDelta,
        )

        dailyStepsDao.upsert(
            buildRow(
                state = state,
                goal = profile.dailyStepGoal,
                profile = profile,
                existing = existing,
                activeMillis = activeUpdate.activeMillis,
                lastStepMillis = if (stepsDelta > 0L) activeUpdate.lastStepMillis else existing?.lastStepMillis,
                now = now,
            ),
        )

        result
    }

    /**
     * Closes out the previous day without a sensor reading. Called by the
     * scheduled midnight worker and on app start, so history is correct even
     * when the user took no steps around the boundary.
     */
    suspend fun rolloverIfNeeded(): StepUpdateResult? = mutex.withLock {
        val today = time.today()
        val previousEntity = dailyStepsDao.getMostRecent() ?: return@withLock null
        val previousState = previousEntity.toTrackingState()
        if (!today.isAfter(previousState.date)) return@withLock null

        val now = time.nowMillis()
        val profile = profileRepository.currentProfile()
        val result = StepCounterEngine.onDateChange(previousState, today, now)

        result.finalizedDay?.let { finalized ->
            dailyStepsDao.upsert(
                previousEntity.copy(
                    steps = finalized.steps,
                    distanceMeters = DistanceCalculator.distanceMeters(finalized.steps, profile),
                    calories = CalorieCalculator.estimateCaloriesForSteps(
                        steps = finalized.steps,
                        profile = profile,
                        durationMillis = previousEntity.activeMillis,
                    ),
                    updatedAt = now,
                ),
            )
        }

        dailyStepsDao.upsert(
            buildRow(
                state = result.state,
                goal = profile.dailyStepGoal,
                profile = profile,
                existing = dailyStepsDao.getByDate(DateKeys.toKey(result.state.date)),
                activeMillis = 0L,
                lastStepMillis = null,
                now = now,
            ),
        )

        result
    }

    /**
     * Re-applies the current goal to today's row. Called after the user changes
     * their goal so the dashboard and streak agree immediately; past days keep
     * the goal that was in force when they were walked.
     */
    suspend fun applyGoalToToday(goal: Int) = mutex.withLock {
        val key = DateKeys.toKey(time.today())
        val existing = dailyStepsDao.getByDate(key) ?: return@withLock
        dailyStepsDao.upsert(existing.copy(goal = goal, updatedAt = time.nowMillis()))
    }

    /**
     * Recomputes today's derived estimates after a profile change (a new
     * weight or height changes distance and calories, never the step count).
     */
    suspend fun recomputeTodayEstimates() = mutex.withLock {
        val key = DateKeys.toKey(time.today())
        val existing = dailyStepsDao.getByDate(key) ?: return@withLock
        val profile = profileRepository.currentProfile()
        dailyStepsDao.upsert(
            existing.copy(
                goal = profile.dailyStepGoal,
                distanceMeters = DistanceCalculator.distanceMeters(existing.steps, profile),
                calories = CalorieCalculator.estimateCaloriesForSteps(
                    steps = existing.steps,
                    profile = profile,
                    durationMillis = existing.activeMillis,
                ),
                updatedAt = time.nowMillis(),
            ),
        )
    }

    private fun buildRow(
        state: StepTrackingState,
        goal: Int,
        profile: UserProfile,
        existing: DailyStepsEntity?,
        activeMillis: Long,
        lastStepMillis: Long?,
        now: Long,
    ): DailyStepsEntity {
        val steps = state.stepsToday
        return DailyStepsEntity(
            date = DateKeys.toKey(state.date),
            steps = steps,
            goal = goal,
            distanceMeters = DistanceCalculator.distanceMeters(steps, profile),
            calories = CalorieCalculator.estimateCaloriesForSteps(
                steps = steps,
                profile = profile,
                durationMillis = activeMillis,
            ),
            sensorBaseline = state.baselineValue,
            sensorLastValue = state.lastSensorValue,
            carriedSteps = state.carriedSteps,
            bootTimestamp = state.bootTimestampMillis,
            activeMillis = activeMillis,
            lastStepMillis = lastStepMillis,
            createdAt = existing?.createdAt ?: now,
            updatedAt = now,
        )
    }
}
