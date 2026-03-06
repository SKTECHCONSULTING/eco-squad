package com.ecosquad.presentation.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import com.ecosquad.R
import com.ecosquad.domain.model.Mission
import com.ecosquad.domain.model.MissionDetailState
import com.ecosquad.domain.model.MissionStatus
import com.ecosquad.domain.model.Result
import com.ecosquad.presentation.components.MissionTypeChip
import com.ecosquad.presentation.components.StatusBadge
import com.ecosquad.presentation.viewmodel.LocationState
import com.ecosquad.presentation.viewmodel.LocationViewModel
import com.ecosquad.presentation.viewmodel.MissionViewModel
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.MultiplePermissionsState

@OptIn(ExperimentalMaterial3Api::class, ExperimentalPermissionsApi::class)
@Composable
fun MissionDetailScreen(
    missionId: String,
    navController: NavHostController,
    permissionState: MultiplePermissionsState,
    viewModel: MissionViewModel = hiltViewModel(),
    locationViewModel: LocationViewModel = hiltViewModel()
) {
    val missionState by viewModel.missionDetailState.collectAsState()
    val claimState by viewModel.claimState.collectAsState()
    val submitState by viewModel.submitEvidenceState.collectAsState()
    val locationState by locationViewModel.locationState.collectAsState()
    
    var showClaimDialog by remember { mutableStateOf(false) }
    var showSubmitDialog by remember { mutableStateOf(false) }
    var showCamera by remember { mutableStateOf(false) }
    
    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success) {
            showSubmitDialog = true
        }
    }
    
    LaunchedEffect(missionId) {
        viewModel.getMission(missionId)
    }
    
    LaunchedEffect(claimState) {
        if (claimState is Result.Success) {
            showClaimDialog = false
            viewModel.clearClaimState()
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Mission Details") },
                navigationIcon = {
                    IconButton(onClick = { navController.navigateUp() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back")
                    }
                }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (missionState) {
                is MissionDetailState.Loading -> {
                    LoadingContent()
                }
                is MissionDetailState.Error -> {
                    ErrorContent(
                        message = (missionState as MissionDetailState.Error).message,
                        onRetry = { viewModel.getMission(missionId) }
                    )
                }
                is MissionDetailState.Success -> {
                    val mission = (missionState as MissionDetailState.Success).mission
                    MissionDetailContent(
                        mission = mission,
                        onClaimClick = { showClaimDialog = true },
                        onSubmitEvidenceClick = {
                            if (permissionState.allPermissionsGranted) {
                                showCamera = true
                            } else {
                                permissionState.launchMultiplePermissionRequest()
                            }
                        }
                    )
                }
            }
        }
    }
    
    // Claim Confirmation Dialog
    if (showClaimDialog) {
        AlertDialog(
            onDismissRequest = { showClaimDialog = false },
            title = { Text("Claim Mission") },
            text = { Text("Do you want to claim this mission for your squad?") },
            confirmButton = {
                Button(
                    onClick = {
                        // Use a default squad ID - in real app, get from user profile
                        viewModel.claimMission(missionId, "squad-123")
                    },
                    enabled = claimState !is Result.Loading
                ) {
                    if (claimState is Result.Loading) {
                        CircularProgressIndicator(modifier = Modifier.size(20.dp))
                    } else {
                        Text("Claim")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { showClaimDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }
    
    // Camera Screen
    if (showCamera) {
        Dialog(onDismissRequest = { showCamera = false }) {
            CameraScreen(
                onImageCaptured = { uri ->
                    showCamera = false
                    // Submit evidence with captured image
                    val location = (locationState as? LocationState.Success)?.location
                    location?.let {
                        viewModel.submitEvidence(
                            missionId = missionId,
                            imageS3Key = uri.toString(), // In real app, upload to S3 first
                            lat = it.latitude,
                            lng = it.longitude
                        )
                    }
                },
                onError = { showCamera = false }
            )
        }
    }
    
    // Submit Evidence Confirmation Dialog
    if (showSubmitDialog) {
        AlertDialog(
            onDismissRequest = { showSubmitDialog = false },
            title = { Text("Evidence Submitted") },
            text = { Text("Your evidence has been submitted and is pending verification.") },
            confirmButton = {
                TextButton(onClick = { showSubmitDialog = false }) {
                    Text("OK")
                }
            }
        )
    }
}

@Composable
fun MissionDetailContent(
    mission: Mission,
    onClaimClick: () -> Unit,
    onSubmitEvidenceClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // Header Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    MissionTypeChip(type = mission.type)
                    StatusBadge(status = mission.status)
                }
                
                Spacer(modifier = Modifier.height(12.dp))
                
                Text(
                    text = mission.title,
                    style = MaterialTheme.typography.headlineSmall
                )
                
                Spacer(modifier = Modifier.height(8.dp))
                
                // Impact Points
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = stringResource(R.string.impact_points, mission.impactPoints),
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Description Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    text = "Description",
                    style = MaterialTheme.typography.titleMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = mission.description,
                    style = MaterialTheme.typography.bodyMedium
                )
                
                // Tags
                if (mission.tags.isNotEmpty()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        mission.tags.forEach { tag ->
                            Surface(
                                color = MaterialTheme.colorScheme.surfaceVariant,
                                shape = RoundedCornerShape(16.dp)
                            ) {
                                Text(
                                    text = tag,
                                    style = MaterialTheme.typography.labelSmall,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        
        // Location Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp)
            ) {
                Text(
                    text = "Location",
                    style = MaterialTheme.typography.titleMedium
                )
                Spacer(modifier = Modifier.height(8.dp))
                mission.location.address?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                Text(
                    text = "Lat: ${"%.6f".format(mission.location.lat)}, Lng: ${"%.6f".format(mission.location.lng)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // Action Buttons
        when (mission.status) {
            MissionStatus.AVAILABLE -> {
                Button(
                    onClick = onClaimClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(stringResource(R.string.action_claim))
                }
            }
            MissionStatus.CLAIMED, MissionStatus.IN_PROGRESS -> {
                Button(
                    onClick = onSubmitEvidenceClick,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.CameraAlt, null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.action_submit_evidence))
                }
            }
            MissionStatus.PENDING_VERIFICATION -> {
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .padding(16.dp)
                            .fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.CheckCircle, null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Awaiting Verification")
                    }
                }
            }
            else -> {
                // No actions for completed/expired
            }
        }
    }
}
