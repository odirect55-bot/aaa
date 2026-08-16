package com.walkfit.core.format

import com.walkfit.core.metrics.DistanceCalculator
import com.walkfit.core.model.DistanceUnit
import kotlin.math.roundToLong

/**
 * Display formatting shared by the dashboard, history and notifications.
 * Pure string work, kept out of the Composables so it can be tested.
 */
object Formatters {

    /** 7842 -> "7,842". */
    fun steps(value: Long): String {
        val negative = value < 0
        val text = kotlin.math.abs(value).toString()
        val builder = StringBuilder()
        for ((index, char) in text.withIndex()) {
            if (index > 0 && (text.length - index) % 3 == 0) builder.append(',')
            builder.append(char)
        }
        return if (negative) "-$builder" else builder.toString()
    }

    /** 5642.0 m -> "5.6 km" (or "3.5 mi"). */
    fun distance(meters: Double, unit: DistanceUnit = DistanceUnit.KILOMETERS): String =
        when (unit) {
            DistanceUnit.KILOMETERS -> "${oneDecimal(DistanceCalculator.metersToKilometers(meters))} km"
            DistanceUnit.MILES -> "${oneDecimal(DistanceCalculator.metersToMiles(meters))} mi"
        }

    /** 280.4 -> "280 kcal". */
    fun calories(value: Double): String = "${value.roundToLong()} kcal"

    /** 4_320_000 ms -> "1h 12m"; under an hour -> "12m"; under a minute -> "0m". */
    fun duration(millis: Long): String {
        val safe = millis.coerceAtLeast(0L)
        val totalMinutes = safe / 60_000L
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        return if (hours > 0) "${hours}h ${minutes}m" else "${minutes}m"
    }

    /** 4_320_000 ms -> "01:12:00", for the live session timer. */
    fun timer(millis: Long): String {
        val safe = millis.coerceAtLeast(0L)
        val totalSeconds = safe / 1000L
        val hours = totalSeconds / 3600
        val minutes = (totalSeconds % 3600) / 60
        val seconds = totalSeconds % 60
        return buildString {
            append(pad(hours))
            append(':')
            append(pad(minutes))
            append(':')
            append(pad(seconds))
        }
    }

    fun percent(value: Int): String = "$value%"

    private fun pad(value: Long): String = if (value < 10) "0$value" else value.toString()

    private fun oneDecimal(value: Double): String {
        val rounded = (value * 10).roundToLong()
        val whole = rounded / 10
        val fraction = kotlin.math.abs(rounded % 10)
        return "$whole.$fraction"
    }
}
