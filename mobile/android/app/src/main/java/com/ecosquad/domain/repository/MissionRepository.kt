package com.ecosquad.domain.repository

import com.ecosquad.domain.model.ClaimMissionRequest
import com.ecosquad.domain.model.ClaimMissionResponse
import com.ecosquad.domain.model.DiscoverMissionsResponse
import com.ecosquad.domain.model.Mission
import com.ecosquad.domain.model.Result
import com.ecosquad.domain.model.SubmitEvidenceRequest
import com.ecosquad.domain.model.SubmitEvidenceResponse
import kotlinx.coroutines.flow.Flow

interface MissionRepository {
    suspend fun discoverMissions(lat: Double, lng: Double, radius: Int = 5000): Result<DiscoverMissionsResponse>
    suspend fun getMission(missionId: String): Result<Mission>
    suspend fun claimMission(missionId: String, squadId: String): Result<ClaimMissionResponse>
    suspend fun submitEvidence(missionId: String, request: SubmitEvidenceRequest): Result<SubmitEvidenceResponse>
    
    // Local cache operations
    fun getCachedMissions(): Flow<List<Mission>>
    suspend fun cacheMissions(missions: List<Mission>)
}
