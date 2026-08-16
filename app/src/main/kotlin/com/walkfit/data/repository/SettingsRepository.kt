package com.walkfit.data.repository

import com.walkfit.core.model.AppSettings
import com.walkfit.core.notifications.NotificationKind
import com.walkfit.data.local.AppSettingsDao
import com.walkfit.data.local.AppSettingsEntity
import com.walkfit.data.mapper.toEntity
import com.walkfit.data.mapper.toSettings
import com.walkfit.data.util.DateKeys
import com.walkfit.data.util.TimeProvider
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

class SettingsRepository(
    private val dao: AppSettingsDao,
    private val time: TimeProvider,
) {

    val settings: Flow<AppSettings> = dao.observe(AppSettingsEntity.SINGLETON_ID)
        .map { it?.toSettings() ?: AppSettings.DEFAULT }

    suspend fun currentSettings(): AppSettings =
        dao.get(AppSettingsEntity.SINGLETON_ID)?.toSettings() ?: AppSettings.DEFAULT

    suspend fun updateSettings(settings: AppSettings) {
        val existing = dao.get(AppSettingsEntity.SINGLETON_ID)
        dao.upsert(
            settings.toEntity(
                notificationsSentToday = existing?.notificationsSentToday.orEmpty(),
                notificationsDate = existing?.notificationsDate ?: DateKeys.toKey(time.today()),
            ),
        )
    }

    /**
     * Which nudges have already gone out today. The stored set is discarded
     * when the date changes, which is what makes "once per day" work across
     * process restarts.
     */
    suspend fun notificationsSentToday(): Set<NotificationKind> {
        val entity = dao.get(AppSettingsEntity.SINGLETON_ID) ?: return emptySet()
        if (entity.notificationsDate != DateKeys.toKey(time.today())) return emptySet()
        return entity.notificationsSentToday
            .split(',')
            .filter { it.isNotBlank() }
            .mapNotNull { name -> runCatching { NotificationKind.valueOf(name) }.getOrNull() }
            .toSet()
    }

    suspend fun markNotificationSent(kind: NotificationKind) {
        val todayKey = DateKeys.toKey(time.today())
        val existing = dao.get(AppSettingsEntity.SINGLETON_ID)
        val current = if (existing?.notificationsDate == todayKey) {
            notificationsSentToday()
        } else {
            emptySet()
        }
        val updated = (current + kind).joinToString(",") { it.name }
        val settings = existing?.toSettings() ?: AppSettings.DEFAULT
        dao.upsert(settings.toEntity(notificationsSentToday = updated, notificationsDate = todayKey))
    }
}
