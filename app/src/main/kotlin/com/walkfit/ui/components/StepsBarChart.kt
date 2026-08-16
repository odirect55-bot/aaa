package com.walkfit.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.walkfit.core.format.Formatters

/** One bar of [StepsBarChart]. */
data class BarChartEntry(
    val label: String,
    val value: Long,
    val goalReached: Boolean,
)

/**
 * Compact bar chart for daily / weekly / monthly step totals.
 *
 * Bars that met their goal are drawn in the primary colour; the rest use a
 * muted tone. Colour is never the only signal — the spoken description carries
 * the same information for screen-reader users.
 */
@Composable
fun StepsBarChart(
    entries: List<BarChartEntry>,
    modifier: Modifier = Modifier,
    height: Dp = 160.dp,
    maxLabels: Int = 8,
) {
    if (entries.isEmpty()) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .height(height),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "No data yet",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        return
    }

    val peak = entries.maxOf { it.value }.coerceAtLeast(1L)
    // With many bars, only label every nth so the axis stays readable.
    val labelStep = maxOf(1, entries.size / maxLabels)
    val summary = buildString {
        append("Bar chart, ${entries.size} periods. ")
        append("Highest ${Formatters.steps(peak)} steps. ")
        append(entries.count { it.goalReached })
        append(" of ${entries.size} reached the goal.")
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clearAndSetSemantics { contentDescription = summary },
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.Bottom,
    ) {
        entries.forEachIndexed { index, entry ->
            val fraction = (entry.value.toDouble() / peak).toFloat().coerceIn(0f, 1f)
            val animated by animateFloatAsState(
                targetValue = fraction,
                animationSpec = tween(durationMillis = 600),
                label = "bar$index",
            )
            val barColor = if (entry.goalReached) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.primary.copy(alpha = 0.28f)
            }

            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Bottom,
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth(),
                    contentAlignment = Alignment.BottomCenter,
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            // A hairline keeps zero-step days visible as a
                            // deliberate zero rather than a missing bar.
                            .fillMaxHeight(if (animated <= 0f) 0.012f else animated)
                            .clip(RoundedCornerShape(topStart = 6.dp, topEnd = 6.dp))
                            .background(barColor),
                    )
                }
                Text(
                    text = if (index % labelStep == 0) entry.label else "",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Clip,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }
    }
}

/** Slim horizontal progress bar used in history rows. */
@Composable
fun MiniProgressBar(
    progress: Float,
    modifier: Modifier = Modifier,
    height: Dp = 6.dp,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(height / 2))
            .background(MaterialTheme.colorScheme.surfaceVariant),
    ) {
        val clamped = progress.coerceIn(0f, 1f)
        if (clamped > 0f) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(clamped)
                    .clip(RoundedCornerShape(height / 2))
                    .background(MaterialTheme.colorScheme.primary),
            )
        }
    }
}

