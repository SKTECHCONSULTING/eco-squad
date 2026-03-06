package com.ecosquad.presentation.screens

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
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
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import com.ecosquad.R
import com.ecosquad.domain.model.Mission
import com.ecosquad.domain.model.MissionStatus
import com.ecosquad.presentation.components.PermissionRationale
import com.ecosquad.presentation.viewmodel.LocationState
import com.ecosquad.presentation.viewmodel.LocationViewModel
import com.ecosquad.presentation.viewmodel.MissionViewModel
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.MultiplePermissionsState
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapProperties
import com.google.maps.android.compose.MapType
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState

@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@Composable
fun MapScreen(
    navController: NavHostController,
    permissionState: MultiplePermissionsState,
    viewModel: MissionViewModel = hiltViewModel(),
    locationViewModel: LocationViewModel = hiltViewModel()
) {
    val missionsState by viewModel.missionsState.collectAsState()
    val locationState by locationViewModel.locationState.collectAsState()
    
    var currentLocation by remember { mutableStateOf<LatLng?>(null) }
    var missions by remember { mutableStateOf<List<Mission>>(emptyList()) }
    
    val cameraPositionState = rememberCameraPositionState()
    
    // Request permissions and fetch location
    LaunchedEffect(Unit) {
        if (!permissionState.allPermissionsGranted) {
            permissionState.launchMultiplePermissionRequest()
        } else {
            locationViewModel.fetchCurrentLocation()
        }
    }
    
    // Update map when location is available
    LaunchedEffect(locationState) {
        if (locationState is LocationState.Success) {
            val location = (locationState as LocationState.Success).location
            val latLng = LatLng(location.latitude, location.longitude)
            currentLocation = latLng
            cameraPositionState.position = CameraPosition.fromLatLngZoom(latLng, 14f)
            viewModel.discoverMissions(location.latitude, location.longitude)
        }
    }
    
    // Update missions
    LaunchedEffect(missionsState) {
        if (missionsState is com.ecosquad.domain.model.MissionListState.Success) {
            missions = (missionsState as com.ecosquad.domain.model.MissionListState.Success).missions
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.nav_map)) }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { locationViewModel.fetchCurrentLocation() }
            ) {
                Icon(Icons.Default.MyLocation, contentDescription = "My Location")
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when {
                !permissionState.allPermissionsGranted -> {
                    PermissionRationale(
                        permissionState = permissionState,
                        title = "Permissions Required",
                        description = "Location permission is needed to show nearby missions on the map."
                    )
                }
                else -> {
                    GoogleMap(
                        modifier = Modifier.fillMaxSize(),
                        cameraPositionState = cameraPositionState,
                        properties = MapProperties(
                            isMyLocationEnabled = permissionState.allPermissionsGranted,
                            mapType = MapType.NORMAL
                        ),
                        uiSettings = MapUiSettings(
                            zoomControlsEnabled = true,
                            myLocationButtonEnabled = false
                        )
                    ) {
                        // Mission markers
                        missions.forEach { mission ->
                            val position = LatLng(
                                mission.location.lat,
                                mission.location.lng
                            )
                            Marker(
                                state = MarkerState(position = position),
                                title = mission.title,
                                snippet = mission.description.take(50) + "...",
                                icon = when (mission.status) {
                                    MissionStatus.AVAILABLE -> BitmapDescriptorFactory.defaultMarker(
                                        BitmapDescriptorFactory.HUE_GREEN
                                    )
                                    MissionStatus.CLAIMED -> BitmapDescriptorFactory.defaultMarker(
                                        BitmapDescriptorFactory.HUE_BLUE
                                    )
                                    MissionStatus.IN_PROGRESS -> BitmapDescriptorFactory.defaultMarker(
                                        BitmapDescriptorFactory.HUE_ORANGE
                                    )
                                    else -> BitmapDescriptorFactory.defaultMarker(
                                        BitmapDescriptorFactory.HUE_RED
                                    )
                                },
                                onClick = {
                                    navController.navigate("mission/${mission.id}")
                                    true
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
