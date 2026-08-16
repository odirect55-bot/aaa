package com.walkfit.data.util

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Indirection over the system clock so repositories can be exercised with a
 * fixed date in tests.
 */
interface TimeProvider {
    fun nowMillis(): Long
    fun today(): LocalDate
    fun dateOf(epochMillis: Long): LocalDate
}

class SystemTimeProvider(
    private val zoneId: () -> ZoneId = { ZoneId.systemDefault() },
) : TimeProvider {
    override fun nowMillis(): Long = System.currentTimeMillis()

    override fun today(): LocalDate = LocalDate.now(zoneId())

    override fun dateOf(epochMillis: Long): LocalDate =
        Instant.ofEpochMilli(epochMillis).atZone(zoneId()).toLocalDate()
}

/** `yyyy-MM-dd`, the format used for every date column. */
object DateKeys {
    private val FORMATTER: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    fun toKey(date: LocalDate): String = date.format(FORMATTER)

    fun fromKey(key: String): LocalDate = LocalDate.parse(key, FORMATTER)
}
