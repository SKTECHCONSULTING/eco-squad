package com.ecosquad.data.remote

import com.ecosquad.domain.model.ClaimMissionRequest
import com.ecosquad.domain.model.ClaimMissionResponse
import com.ecosquad.domain.model.DiscoverMissionsResponse
import com.ecosquad.domain.model.Mission
import com.ecosquad.domain.model.SubmitEvidenceRequest
import com.ecosquad.domain.model.SubmitEvidenceResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface EcoSquadApi {
    
    // Mission Endpoints
    @GET("api/missions")
    suspend fun discoverMissions(
        @Query("lat") lat: Double,
        @Query("lng") lng: Double,
        @Query("radius") radius: Int = 5000 // default 5km
    ): Response<DiscoverMissionsResponse>
    
    @GET("api/missions/{id}")
    suspend fun getMission(
        @Path("id") missionId: String
    ): Response<Mission>
    
    @POST("api/missions/{id}/claim")
    suspend fun claimMission(
        @Path("id") missionId: String,
        @Body request: ClaimMissionRequest
    ): Response<ClaimMissionResponse>
    
    @POST("api/missions/{id}/submit-evidence")
    suspend fun submitEvidence(
        @Path("id") missionId: String,
        @Body request: SubmitEvidenceRequest
    ): Response<SubmitEvidenceResponse>
    
    // Squad Endpoints
    @GET("api/squads/{id}")
    suspend fun getSquad(
        @Path("id") squadId: String
    ): Response<com.ecosquad.domain.model.Squad>
    
    @GET("api/squads/{id}/missions")
    suspend fun getSquadMissions(
        @Path("id") squadId: String
    ): Response<List<Mission>>
    
    // User Endpoints
    @GET("api/user/profile")
    suspend fun getUserProfile(): Response<com.ecosquad.domain.model.User>
    
    @GET("api/user/missions")
    suspend fun getUserMissions(): Response<List<Mission>>
}
