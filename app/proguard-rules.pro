# Room generates implementations reflectively referenced by the runtime.
-keep class androidx.room.RoomDatabase { *; }
-keep class com.walkfit.data.local.** { *; }

# Keep the domain models used as Room entities and Compose state.
-keep class com.walkfit.core.model.** { *; }

# WorkManager instantiates workers by name.
-keep class * extends androidx.work.ListenableWorker { *; }
