package com.walkfit.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.walkfit.core.model.ThemeMode

// A calm, energetic green as the primary, with a warm accent for calories and
// a cool one for distance, so the three dashboard stats stay distinguishable
// at a glance in both themes.
private val Green40 = Color(0xFF2E7D57)
private val Green80 = Color(0xFF7FD1A6)
private val Teal40 = Color(0xFF00696E)
private val Teal80 = Color(0xFF64D6DC)
private val Amber40 = Color(0xFF8A5100)
private val Amber80 = Color(0xFFFFB868)

private val LightColors = lightColorScheme(
    primary = Green40,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFB6F2CE),
    onPrimaryContainer = Color(0xFF002114),
    secondary = Teal40,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFB0ECF0),
    onSecondaryContainer = Color(0xFF002022),
    tertiary = Amber40,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFFDDB8),
    onTertiaryContainer = Color(0xFF2C1600),
    background = Color(0xFFF7FBF7),
    onBackground = Color(0xFF191C1A),
    surface = Color(0xFFF7FBF7),
    onSurface = Color(0xFF191C1A),
    surfaceVariant = Color(0xFFDCE5DC),
    onSurfaceVariant = Color(0xFF404942),
    outline = Color(0xFF707972),
    error = Color(0xFFBA1A1A),
    onError = Color.White,
    errorContainer = Color(0xFFFFDAD6),
    onErrorContainer = Color(0xFF410002),
)

private val DarkColors = darkColorScheme(
    primary = Green80,
    onPrimary = Color(0xFF003826),
    primaryContainer = Color(0xFF00513A),
    onPrimaryContainer = Color(0xFFB6F2CE),
    secondary = Teal80,
    onSecondary = Color(0xFF00373A),
    secondaryContainer = Color(0xFF004F53),
    onSecondaryContainer = Color(0xFFB0ECF0),
    tertiary = Amber80,
    onTertiary = Color(0xFF4A2800),
    tertiaryContainer = Color(0xFF693C00),
    onTertiaryContainer = Color(0xFFFFDDB8),
    background = Color(0xFF101412),
    onBackground = Color(0xFFE1E3DF),
    surface = Color(0xFF101412),
    onSurface = Color(0xFFE1E3DF),
    surfaceVariant = Color(0xFF404942),
    onSurfaceVariant = Color(0xFFC0C9C0),
    outline = Color(0xFF8A938B),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
)

private val WalkFitTypography = Typography(
    displayLarge = TextStyle(
        fontSize = 72.sp,
        lineHeight = 76.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = (-2).sp,
    ),
    headlineSmall = TextStyle(
        fontSize = 24.sp,
        lineHeight = 32.sp,
        fontWeight = FontWeight.SemiBold,
    ),
    titleMedium = TextStyle(
        fontSize = 16.sp,
        lineHeight = 24.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.15.sp,
    ),
    bodyMedium = TextStyle(
        fontSize = 14.sp,
        lineHeight = 20.sp,
        fontWeight = FontWeight.Normal,
        letterSpacing = 0.25.sp,
    ),
    labelMedium = TextStyle(
        fontSize = 12.sp,
        lineHeight = 16.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.5.sp,
    ),
)

@Composable
fun WalkFitTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    // Material You on Android 12+, but only when the user has not pinned a
    // theme; a pinned theme should look the same on every device.
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit,
) {
    val darkTheme = when (themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }

    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColors
        else -> LightColors
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = WalkFitTypography,
        content = content,
    )
}
