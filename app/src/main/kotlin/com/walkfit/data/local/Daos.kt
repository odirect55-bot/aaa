package com.walkfit.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

// Note: no Kotlin default parameter values on DAO methods — Room generates its
// implementations from the declared signature, so callers pass the singleton id
// explicitly (see the SINGLETON_ID constants on the entities).

@Dao
interface DailyStepsDao {

    @Query("SELECT * FROM daily_steps WHERE date = :date LIMIT 1")
    suspend fun getByDate(date: String): DailyStepsEntity?

    @Query("SELECT * FROM daily_steps WHERE date = :date LIMIT 1")
    fun observeByDate(date: String): Flow<DailyStepsEntity?>

    /** Newest first. */
    @Query("SELECT * FROM daily_steps ORDER BY date DESC")
    fun observeAll(): Flow<List<DailyStepsEntity>>

    /** Most recent stored day, which carries the live sensor baseline. */
    @Query("SELECT * FROM daily_steps ORDER BY date DESC LIMIT 1")
    suspend fun getMostRecent(): DailyStepsEntity?

    @Upsert
    suspend fun upsert(entity: DailyStepsEntity)
}

@Dao
interface WalkingSessionDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: WalkingSessionEntity): Long

    @Query("SELECT * FROM walking_sessions ORDER BY startTime DESC")
    fun observeAll(): Flow<List<WalkingSessionEntity>>
}

@Dao
interface UserProfileDao {

    @Query("SELECT * FROM user_profile WHERE id = :id LIMIT 1")
    fun observe(id: Int): Flow<UserProfileEntity?>

    @Query("SELECT * FROM user_profile WHERE id = :id LIMIT 1")
    suspend fun get(id: Int): UserProfileEntity?

    @Upsert
    suspend fun upsert(entity: UserProfileEntity)
}

@Dao
interface GoalDao {

    @Query("SELECT * FROM goal WHERE id = :id LIMIT 1")
    fun observe(id: Int): Flow<GoalEntity?>

    @Query("SELECT * FROM goal WHERE id = :id LIMIT 1")
    suspend fun get(id: Int): GoalEntity?

    @Upsert
    suspend fun upsert(entity: GoalEntity)
}

@Dao
interface AppSettingsDao {

    @Query("SELECT * FROM app_settings WHERE id = :id LIMIT 1")
    fun observe(id: Int): Flow<AppSettingsEntity?>

    @Query("SELECT * FROM app_settings WHERE id = :id LIMIT 1")
    suspend fun get(id: Int): AppSettingsEntity?

    @Upsert
    suspend fun upsert(entity: AppSettingsEntity)
}
