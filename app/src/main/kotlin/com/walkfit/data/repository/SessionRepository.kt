package com.walkfit.data.repository

import com.walkfit.core.model.CompletedSession
import com.walkfit.data.local.WalkingSessionDao
import com.walkfit.data.local.WalkingSessionEntity
import com.walkfit.data.util.DateKeys
import com.walkfit.data.util.TimeProvider
import kotlinx.coroutines.flow.Flow

class SessionRepository(
    private val dao: WalkingSessionDao,
    private val time: TimeProvider,
) {

    fun observeAll(): Flow<List<WalkingSessionEntity>> = dao.observeAll()

    suspend fun save(session: CompletedSession): Long = dao.insert(
        WalkingSessionEntity(
            startTime = session.startTimeMillis,
            endTime = session.endTimeMillis,
            duration = session.durationMillis,
            steps = session.steps,
            distanceMeters = session.distanceMeters,
            calories = session.calories,
            date = DateKeys.toKey(time.dateOf(session.startTimeMillis)),
        ),
    )
}
