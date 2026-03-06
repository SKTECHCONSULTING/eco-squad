package com.ecosquad.domain.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

// Request Models
@JsonClass(generateAdapter = true)
data class DiscoverMissionsRequest(
    val lat: Double,
    val lng: Double,
    val radius: Int // in meters
)

@JsonClass(generateAdapter = true)
data class ClaimMissionRequest(
    @Json(name = "squadId")
    val squadId: String
)

@JsonClass(generateAdapter = true)
data class SubmitEvidenceRequest(
    @Json(name = "imageS3Key")
    val imageS3Key: String,
    val lat: Double,
    val lng: Double
)

// Response Models
@JsonClass(generateAdapter = true)
data class DiscoverMissionsResponse(
    val missions: List<Mission> = emptyList(),
    val total: Int = 0
)

@JsonClass(generateAdapter = true)
data class ClaimMissionResponse(
    val status: String, // "CLAIMED"
    @Json(name = "expiresAt")
    val expiresAt: String,
    val mission: Mission
)

@JsonClass(generateAdapter = true)
data class SubmitEvidenceResponse(
    val status: String, // "PENDING_VERIFICATION"
    @Json(name = "evidenceId")
    val evidenceId: String,
    @Json(name = "estimatedReviewTime")
    val estimatedReviewTime: String
)

@JsonClass(generateAdapter = true)
data class ApiError(
    val error: String,
    val message: String,
    val code: Int? = null
)

// UI State Models
sealed class Result<out T> {
    data class Success<T>(val data: T) : Result<T>()
    data class Error(val message: String, val code: Int? = null) : Result<Nothing>()
    data object Loading : Result<Nothing>()
}

sealed class MissionListState {
    data object Loading : MissionListState()
    data class Success(val missions: List<Mission>) : MissionListState()
    data class Error(val message: String) : MissionListState()
    data object Empty : MissionListState()
}

sealed class MissionDetailState {
    data object Loading : MissionDetailState()
    data class Success(val mission: Mission) : MissionDetailState()
    data class Error(val message: String) : MissionDetailState()
}
