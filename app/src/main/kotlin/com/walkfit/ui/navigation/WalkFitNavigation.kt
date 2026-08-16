package com.walkfit.ui.navigation

import androidx.annotation.StringRes
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.ui.graphics.vector.ImageVector
import com.walkfit.R

/** The four bottom-navigation destinations. */
enum class WalkFitDestination(
    val route: String,
    @StringRes val titleRes: Int,
    val icon: ImageVector,
) {
    HOME("home", R.string.nav_home, Icons.Filled.DirectionsWalk),
    HISTORY("history", R.string.nav_history, Icons.Filled.History),
    GOALS("goals", R.string.nav_goals, Icons.Filled.EmojiEvents),
    PROFILE("profile", R.string.nav_profile, Icons.Filled.Person),
    ;

    companion object {
        fun fromRoute(route: String?): WalkFitDestination =
            entries.firstOrNull { it.route == route } ?: HOME
    }
}
