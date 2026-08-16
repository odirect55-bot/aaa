package com.walkfit.data.repository

import com.walkfit.core.goals.GoalCalculator
import com.walkfit.core.model.UserProfile
import com.walkfit.data.local.GoalDao
import com.walkfit.data.local.GoalEntity
import com.walkfit.data.local.UserProfileDao
import com.walkfit.data.local.UserProfileEntity
import com.walkfit.data.mapper.toEntity
import com.walkfit.data.mapper.toProfile
import com.walkfit.data.util.TimeProvider
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map

/**
 * The locally stored profile and daily goal. Nothing here is ever uploaded.
 */
class ProfileRepository(
    private val userProfileDao: UserProfileDao,
    private val goalDao: GoalDao,
    private val time: TimeProvider,
) {

    val goal: Flow<Int> = goalDao.observe(GoalEntity.SINGLETON_ID)
        .map { it?.dailyStepGoal ?: UserProfile.DEFAULT_DAILY_GOAL }

    val profile: Flow<UserProfile> =
        combine(userProfileDao.observe(UserProfileEntity.SINGLETON_ID), goal) { entity, dailyGoal ->
            entity?.toProfile(dailyGoal) ?: UserProfile.EMPTY.copy(dailyStepGoal = dailyGoal)
        }

    suspend fun currentProfile(): UserProfile {
        val dailyGoal = currentGoal()
        return userProfileDao.get(UserProfileEntity.SINGLETON_ID)?.toProfile(dailyGoal)
            ?: UserProfile.EMPTY.copy(dailyStepGoal = dailyGoal)
    }

    suspend fun currentGoal(): Int =
        goalDao.get(GoalEntity.SINGLETON_ID)?.dailyStepGoal ?: UserProfile.DEFAULT_DAILY_GOAL

    suspend fun saveProfile(profile: UserProfile) {
        userProfileDao.upsert(profile.toEntity(time.nowMillis()))
        setGoal(profile.dailyStepGoal)
    }

    /** Clamped into the accepted range before it is stored. */
    suspend fun setGoal(goal: Int) {
        goalDao.upsert(
            GoalEntity(
                id = GoalEntity.SINGLETON_ID,
                dailyStepGoal = GoalCalculator.sanitizeGoal(goal),
                updatedAt = time.nowMillis(),
            ),
        )
    }
}
