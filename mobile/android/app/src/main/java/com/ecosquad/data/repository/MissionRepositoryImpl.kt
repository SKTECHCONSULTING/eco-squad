package com.ecosquad.data.repository

import com.ecosquad.data.remote.EcoSquadApi
import com.ecosquad.domain.model.ClaimMissionRequest
import com.ecosquad.domain.model.ClaimMissionResponse
import com.ecosquad.domain.model.DiscoverMissionsResponse
import com.ecosquad.domain.model.Mission
import com.ecosquad.domain.model.Result
import com.ecosquad.domain.model.SubmitEvidenceRequest
import com.ecosquad.domain.model.SubmitEvidenceResponse
import com.ecosquad.domain.repository.MissionRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MissionRepositoryImpl @Inject constructor(
    private val api: EcoSquadApi
) : MissionRepository {

    private val _cachedMissions = MutableStateFlow<List<Mission>>(emptyList())
    
    override suspend fun discoverMissions(lat: Double, lng: Double, radius: Int): Result<DiscoverMissionsResponse> {
        return try {
            val response = api.discoverMissions(lat, lng, radius)
            if (response.isSuccessful) {
                response.body()?.let {
                    cacheMissions(it.missions)
                    Result.Success(it)
                } ?: Result.Error("Empty response")
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Unknown error")
        }
    }

    override suspend fun getMission(missionId: String): Result<Mission> {
        return try {
            val response = api.getMission(missionId)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.Success(it)
                } ?: Result.Error("Empty response")
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Unknown error")
        }
    }

    override suspend fun claimMission(missionId: String, squadId: String): Result<ClaimMissionResponse> {
        return try {
            val response = api.claimMission(missionId, ClaimMissionRequest(squadId))
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.Success(it)
                } ?: Result.Error("Empty response")
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Unknown error")
        }
    }

    override suspend fun submitEvidence(
        missionId: String, 
        request: SubmitEvidenceRequest
    ): Result<SubmitEvidenceResponse> {
        return try {
            val response = api.submitEvidence(missionId, request)
            if (response.isSuccessful) {
                response.body()?.let {
                    Result.Success(it)
                } ?: Result.Error("Empty response")
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Unknown error")
        }
    }

    override fun getCachedMissions(): Flow<List<Mission>> = _cachedMissions.asStateFlow()

    override suspend fun cacheMissions(missions: List<Mission>) {
        _cachedMissions.value = missions
    }
}
