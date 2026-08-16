package com.walkfit.data

import com.walkfit.data.util.DateKeys
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

/**
 * Date keys are the primary key of the daily_steps table, so their format has
 * to be stable and sortable — history queries rely on lexicographic ordering
 * matching chronological ordering.
 */
class DateKeysTest {

    @Test
    fun `keys are ISO formatted`() {
        assertEquals("2026-03-09", DateKeys.toKey(LocalDate.of(2026, 3, 9)))
        assertEquals("2026-12-31", DateKeys.toKey(LocalDate.of(2026, 12, 31)))
    }

    @Test
    fun `keys round trip`() {
        val date = LocalDate.of(2026, 7, 4)
        assertEquals(date, DateKeys.fromKey(DateKeys.toKey(date)))
    }

    @Test
    fun `keys sort chronologically as strings`() {
        val dates = listOf(
            LocalDate.of(2026, 1, 2),
            LocalDate.of(2025, 12, 31),
            LocalDate.of(2026, 1, 10),
        )
        val sortedKeys = dates.map(DateKeys::toKey).sorted()
        assertEquals(dates.sorted().map(DateKeys::toKey), sortedKeys)
    }
}
