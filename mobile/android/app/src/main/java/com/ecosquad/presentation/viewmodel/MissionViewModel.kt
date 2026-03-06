package com.ecosquad.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ecosquad.domain.model.Mission
import com.ecosquad.domain.model.MissionDetailState
import com.ecosquad.domain.model.MissionListState
import com.ecosquad.domain.model.Result
import com.ecosquad.domain.model.SubmitEvidenceRequest
import com.ecosquad.domain.repository.MissionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MissionViewModel @Inject constructor(
    private val missionRepository: MissionRepository
) : ViewModel() {

    private val _missionsState = MutableStateFlow<MissionListState>(MissionListState.Loading)
    val missionsState: StateFlow<MissionListState> = _missionsState.asStateFlow()

    private val _missionDetailState = MutableStateFlow<MissionDetailState>(MissionDetailState.Loading)
    val missionDetailState: StateFlow<MissionDetailState> = _missionDetailState.asStateFlow()

    private val _claimState = MutableStateFlow<Result<Unit>?>(null)
    val claimState: StateFlow<Result<Unit>?> = _claimState.asStateFlow()

    private val _submitEvidenceState = MutableStateFlow<Result<Unit>?>(null)
    val submitEvidenceState: StateFlow<Result<Unit>?> = _submitEvidenceState.asStateFlow()

    fun discoverMissions(lat: Double, lng: Double, radius: Int = 5000) {
        viewModelScope.launch {
            _missionsState.value = MissionListState.Loading
            when (val result = missionRepository.discoverMissions(lat, lng, radius)) {
                is Result.Success -> {
                    if (result.data.missions.isEmpty()) {
                        _missionsState.value = MissionListState.Empty
                    } else {
                        _missionsState.value = MissionListState.Success(result.data.missions)
                    }
                }
                is Result.Error -> {
                    _missionsState.value = MissionListState.Error(result.message)
                }
                is Result.Loading -> {
                    _missionsState.value = MissionListState.Loading
                }
            }
        }
    }

    fun getMission(missionId: String) {
        viewModelScope.launch {
            _missionDetailState.value = MissionDetailState.Loading
            when (val result = missionRepository.getMission(missionId)) {
                is Result.Success -> {
                    _missionDetailState.value = MissionDetailState.Success(result.data)
                }
                is Result.Error -> {
                    _missionDetailState.value = MissionDetailState.Error(result.message)
                }
                is Result.Loading -> {
                    _missionDetailState.value = MissionDetailState.Loading
                }
            }
        }
    }

    fun claimMission(missionId: String, squadId: String) {
        viewModelScope.launch {
            _claimState.value = Result.Loading
            when (val result = missionRepository.claimMission(missionId, squadId)) {
                is Result.Success -> {
                    _claimState.value = Result.Success(Unit)
                    // Refresh mission details
                    getMission(missionId)
                }
                is Result.Error -> {
                    _claimState.value = Result.Error(result.message)
                }
                is Result.Loading -> {
                    _claimState.value = Result.Loading
                }
            }
        }
    }

    fun submitEvidence(missionId: String, imageS3Key: String, lat: Double, lng: Double) {
        viewModelScope.launch {
            _submitEvidenceState.value = Result.Loading
            val request = SubmitEvidenceRequest(imageS3Key, lat, lng)
            when (val result = missionRepository.submitEvidence(missionId, request)) {
                is Result.Success -> {
                    _submitEvidenceState.value = Result.Success(Unit)
                    // Refresh mission details
                    getMission(missionId)
                }
                is Result.Error -> {
                    _submitEvidenceState.value = Result.Error(result.message)
                }
                is Result.Loading -> {
                    _submitEvidenceState.value = Result.Loading
                }
            }
        }
    }

    fun clearClaimState() {
        _claimState.value = null
    }

    fun clearSubmitEvidenceState() {
        _submitEvidenceState.value = null
    }
}
