package com.ecosquad.presentation.viewmodel

import android.annotation.SuppressLint
import android.location.Location
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

sealed class LocationState {
    data object Loading : LocationState()
    data class Success(val location: Location) : LocationState()
    data class Error(val message: String) : LocationState()
    data object PermissionDenied : LocationState()
}

@HiltViewModel
class LocationViewModel @Inject constructor(
    private val fusedLocationClient: FusedLocationProviderClient
) : ViewModel() {

    private val _locationState = MutableStateFlow<LocationState>(LocationState.Loading)
    val locationState: StateFlow<LocationState> = _locationState.asStateFlow()

    private var cancellationTokenSource: CancellationTokenSource? = null

    @SuppressLint("MissingPermission")
    fun fetchCurrentLocation() {
        viewModelScope.launch {
            _locationState.value = LocationState.Loading
            try {
                cancellationTokenSource = CancellationTokenSource()
                val location = fusedLocationClient.getCurrentLocation(
                    Priority.PRIORITY_HIGH_ACCURACY,
                    cancellationTokenSource!!.token
                ).await()
                
                if (location != null) {
                    _locationState.value = LocationState.Success(location)
                } else {
                    // Fallback to last known location
                    val lastLocation = fusedLocationClient.lastLocation.await()
                    if (lastLocation != null) {
                        _locationState.value = LocationState.Success(lastLocation)
                    } else {
                        _locationState.value = LocationState.Error("Unable to get location")
                    }
                }
            } catch (e: SecurityException) {
                _locationState.value = LocationState.PermissionDenied
            } catch (e: Exception) {
                _locationState.value = LocationState.Error(e.message ?: "Location error")
            }
        }
    }

    fun setPermissionDenied() {
        _locationState.value = LocationState.PermissionDenied
    }

    override fun onCleared() {
        super.onCleared()
        cancellationTokenSource?.cancel()
    }
}
