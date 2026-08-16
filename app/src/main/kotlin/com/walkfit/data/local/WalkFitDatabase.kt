package com.walkfit.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        DailyStepsEntity::class,
        WalkingSessionEntity::class,
        UserProfileEntity::class,
        GoalEntity::class,
        AppSettingsEntity::class,
    ],
    version = 1,
    exportSchema = true,
)
abstract class WalkFitDatabase : RoomDatabase() {

    abstract fun dailyStepsDao(): DailyStepsDao
    abstract fun walkingSessionDao(): WalkingSessionDao
    abstract fun userProfileDao(): UserProfileDao
    abstract fun goalDao(): GoalDao
    abstract fun appSettingsDao(): AppSettingsDao

    companion object {
        private const val DATABASE_NAME = "walkfit.db"

        @Volatile
        private var instance: WalkFitDatabase? = null

        fun getInstance(context: Context): WalkFitDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context).also { instance = it }
            }

        private fun build(context: Context): WalkFitDatabase =
            Room.databaseBuilder(
                context.applicationContext,
                WalkFitDatabase::class.java,
                DATABASE_NAME,
            )
                // History is the point of the app: never drop it silently on
                // upgrade. Future versions must ship real migrations.
                .build()
    }
}
