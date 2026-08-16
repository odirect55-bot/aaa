package com.walkfit.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.walkfit.R
import com.walkfit.ui.goals.GoalsScreen
import com.walkfit.ui.history.HistoryScreen
import com.walkfit.ui.home.HomeScreen
import com.walkfit.ui.navigation.WalkFitDestination
import com.walkfit.ui.profile.ProfileScreen

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WalkFitApp(
    onRequestPermission: () -> Unit,
    onOpenSettings: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val current = WalkFitDestination.fromRoute(backStackEntry?.destination?.route)

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(current.titleRes)) },
                colors = TopAppBarDefaults.topAppBarColors(),
            )
        },
        bottomBar = {
            NavigationBar {
                WalkFitDestination.entries.forEach { destination ->
                    NavigationBarItem(
                        selected = current == destination,
                        onClick = {
                            if (current != destination) {
                                navController.navigate(destination.route) {
                                    // Single instance per tab, state preserved
                                    // when switching back and forth.
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        },
                        icon = {
                            Icon(
                                imageVector = destination.icon,
                                contentDescription = null,
                            )
                        },
                        label = { Text(stringResource(destination.titleRes)) },
                    )
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = WalkFitDestination.HOME.route,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(WalkFitDestination.HOME.route) {
                HomeScreen(
                    onRequestPermission = onRequestPermission,
                    onOpenSettings = onOpenSettings,
                )
            }
            composable(WalkFitDestination.HISTORY.route) {
                HistoryScreen()
            }
            composable(WalkFitDestination.GOALS.route) {
                GoalsScreen()
            }
            composable(WalkFitDestination.PROFILE.route) {
                ProfileScreen(onOpenSettings = onOpenSettings)
            }
        }
    }
}
