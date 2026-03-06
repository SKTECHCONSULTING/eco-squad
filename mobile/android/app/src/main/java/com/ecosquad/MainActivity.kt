package com.ecosquad

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.ecosquad.presentation.screens.MapScreen
import com.ecosquad.presentation.screens.MissionDetailScreen
import com.ecosquad.presentation.screens.MissionListScreen
import com.ecosquad.presentation.screens.ProfileScreen
import com.ecosquad.presentation.screens.SquadScreen
import com.ecosquad.presentation.theme.EcoSquadTheme
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import dagger.hilt.android.AndroidEntryPoint

sealed class Screen(val route: String, val titleRes: Int, val icon: androidx.compose.ui.graphics.vector.ImageVector) {
    data object Missions : Screen("missions", R.string.nav_missions, Icons.Default.LocationOn)
    data object Map : Screen("map", R.string.nav_map, Icons.Default.Map)
    data object Squad : Screen("squad", R.string.nav_squad, Icons.Default.People)
    data object Profile : Screen("profile", R.string.nav_profile, Icons.Default.AccountCircle)
    data object MissionDetail : Screen("mission/{missionId}", R.string.nav_missions, Icons.Default.LocationOn)
}

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @OptIn(ExperimentalPermissionsApi::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            EcoSquadTheme {
                val permissionState = rememberMultiplePermissionsState(
                    permissions = listOf(
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION,
                        Manifest.permission.CAMERA
                    )
                )
                
                val navController = rememberNavController()
                
                Scaffold(
                    bottomBar = { BottomNavigationBar(navController) }
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = Screen.Missions.route,
                        modifier = Modifier.padding(innerPadding)
                    ) {
                        composable(Screen.Missions.route) {
                            MissionListScreen(
                                navController = navController,
                                permissionState = permissionState
                            )
                        }
                        composable(Screen.Map.route) {
                            MapScreen(
                                navController = navController,
                                permissionState = permissionState
                            )
                        }
                        composable(Screen.Squad.route) {
                            SquadScreen(navController = navController)
                        }
                        composable(Screen.Profile.route) {
                            ProfileScreen(navController = navController)
                        }
                        composable(Screen.MissionDetail.route) { backStackEntry ->
                            val missionId = backStackEntry.arguments?.getString("missionId")
                            missionId?.let {
                                MissionDetailScreen(
                                    missionId = it,
                                    navController = navController,
                                    permissionState = permissionState
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun BottomNavigationBar(navController: NavHostController) {
    val items = listOf(
        Screen.Missions,
        Screen.Map,
        Screen.Squad,
        Screen.Profile
    )
    
    NavigationBar {
        val navBackStackEntry by navController.currentBackStackEntryAsState()
        val currentDestination = navBackStackEntry?.destination
        
        items.forEach { screen ->
            NavigationBarItem(
                icon = { Icon(screen.icon, contentDescription = stringResource(screen.titleRes)) },
                label = { Text(stringResource(screen.titleRes)) },
                selected = currentDestination?.hierarchy?.any { it.route == screen.route } == true,
                onClick = {
                    navController.navigate(screen.route) {
                        popUpTo(navController.graph.findStartDestination().id) {
                            saveState = true
                        }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            )
        }
    }
}
