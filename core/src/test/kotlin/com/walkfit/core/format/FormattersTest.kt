package com.walkfit.core.format

import com.walkfit.core.model.DistanceUnit
import org.junit.Assert.assertEquals
import org.junit.Test

class FormattersTest {

    @Test
    fun `step counts are grouped in thousands`() {
        assertEquals("0", Formatters.steps(0))
        assertEquals("842", Formatters.steps(842))
        assertEquals("7,842", Formatters.steps(7_842))
        assertEquals("10,000", Formatters.steps(10_000))
        assertEquals("1,204,998", Formatters.steps(1_204_998))
    }

    @Test
    fun `distance is shown to one decimal in the chosen unit`() {
        assertEquals("5.6 km", Formatters.distance(5_642.0))
        assertEquals("3.5 mi", Formatters.distance(5_642.0, DistanceUnit.MILES))
        assertEquals("0.0 km", Formatters.distance(0.0))
    }

    @Test
    fun `calories are rounded to whole kcal`() {
        assertEquals("280 kcal", Formatters.calories(280.4))
        assertEquals("0 kcal", Formatters.calories(0.0))
    }

    @Test
    fun `durations read naturally`() {
        assertEquals("1h 12m", Formatters.duration(4_320_000L))
        assertEquals("12m", Formatters.duration(720_000L))
        assertEquals("0m", Formatters.duration(0L))
        assertEquals("0m", Formatters.duration(-5L))
    }

    @Test
    fun `the live timer is zero padded`() {
        assertEquals("00:00:00", Formatters.timer(0L))
        assertEquals("00:05:09", Formatters.timer(309_000L))
        assertEquals("01:12:00", Formatters.timer(4_320_000L))
    }
}
