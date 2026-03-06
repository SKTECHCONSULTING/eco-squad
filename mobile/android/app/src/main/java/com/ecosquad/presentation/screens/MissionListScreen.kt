package com.ecosquad.presentation.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import com.ecosquad.R
import com.ecosquad.domain.model.Mission
import com.ecosquad.domain.model.MissionListState
import com.ecosquad.presentation.components.MissionCard
import com.ecosquad.presentation.components.PermissionRationale
import com.ecosquad.presentation.viewmodel.LocationState
import com.ecosquad.presentation.viewmodel.LocationViewModel
import com.ecosquad.presentation.viewmodel.MissionViewModel
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.MultiplePermissionsState

@OptIn(ExperimentalMaterialApi::class, ExperimentalPermissionsApi::class,
    ExperimentalMaterial3Api::class
)
@Composable
fun MissionListScreen(
    navController: NavHostController,
    permissionState: MultiplePermissionsState,
    viewModel: MissionViewModel = hiltViewModel(),
    locationViewModel: LocationViewModel = hiltViewModel()
) {
    val missionsState by viewModel.missionsState.collectAsState()
    val locationState by locationViewModel.locationState.collectAsState()
    var isRefreshing by remember { mutableStateOf(false) }
    
    // Request permissions and fetch location
    LaunchedEffect(Unit) {
        if (!permissionState.allPermissionsGranted) {
            permissionState.launchMultiplePermissionRequest()
        } else {
            locationViewModel.fetchCurrentLocation()
        }
    }
    
    // Fetch missions when location is available
    LaunchedEffect(locationState) {
        if (locationState is LocationState.Success) {
            val location = (locationState as LocationState.Success).location
            viewModel.discoverMissions(location.latitude, location.longitude)
        }
    }
    
    val pullRefreshState = rememberPullRefreshState(
        refreshing = isRefreshing,
        onRefresh = {
            isRefreshing = true
            locationViewModel.fetchCurrentLocation()
            isRefreshing = false
        }
    )
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.nav_missions)) }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .pullRefresh(pullRefreshState)
        ) {
            when {
                !permissionState.allPermissionsGranted -> {
                    PermissionRationale(
                        permissionState = permissionState,
                        title = "Permissions Required",
                        description = "Location and Camera permissions are needed to discover and complete missions."
                    )
                }
                locationState is LocationState.PermissionDenied -> {
                    PermissionDeniedContent(
                        onRequestPermission = { 
                            permissionState.launchMultiplePermissionRequest() 
                        }
                    )
                }
                missionsState is MissionListState.Loading -> {
                    LoadingContent()
                }
                missionsState is MissionListState.Error -> {
                    ErrorContent(
                        message = (missionsState as MissionListState.Error).message,
                        onRetry = { locationViewModel.fetchCurrentLocation() }
                    )
                }
                missionsState is MissionListState.Empty -> {
                    EmptyContent()
                }
                missionsState is MissionListState.Success -> {
                    MissionList(
                        missions = (missionsState as MissionListState.Success).missions,
                        onMissionClick = { missionId ->
                            navController.navigate("mission/$missionId")
                        }
                    )
                }
            }
            
            PullRefreshIndicator(
                refreshing = isRefreshing,
                state = pullRefreshState,
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
    }
}

@Composable
fun MissionList(
    missions: List<Mission>,
    onMissionClick: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize()
    ) {
        items(missions, key = { it.id }) { mission ->
            MissionCard(
                mission = mission,
                onClick = { onMissionClick(mission.id) }
            )
        }
    }
}

@Composable
fun LoadingContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

@Composable
fun ErrorContent(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(64.dp))
        Text(
            text = stringResource(R.string.error_generic),
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onRetry) {
            Text(stringResource(R.string.action_retry))
        }
    }
}

@Composable
fun EmptyContent() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(64.dp))
        Text(
            text = stringResource(R.string.no_missions_nearby),
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Try exploring a different area or come back later!",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun PermissionDeniedContent(onRequestPermission: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(64.dp))
        Text(
            text = stringResource(R.string.location_permission_required),
            style = MaterialTheme.typography.headlineSmall,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onRequestPermission) {
            Text("Grant Permission")
        }
    }
}
