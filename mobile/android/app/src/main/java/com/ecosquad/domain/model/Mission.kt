package com.ecosquad.domain.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Mission(
    val id: String,
    val title: String,
    val description: String,
    val type: MissionType,
    val status: MissionStatus,
    val location: MissionLocation,
    @Json(name = "impactPoints")
    val impactPoints: Int,
    @Json(name = "createdAt")
    val createdAt: String,
    @Json(name = "updatedAt")
    val updatedAt: String? = null,
    @Json(name = "expiresAt")
    val expiresAt: String? = null,
    @Json(name = "claimedBy")
    val claimedBy: String? = null,
    @Json(name = "claimedAt")
    val claimedAt: String? = null,
    @Json(name = "completedAt")
    val completedAt: String? = null,
    val evidence: Evidence? = null,
    val tags: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class MissionLocation(
    val lat: Double,
    val lng: Double,
    val geohash: String,
    val address: String? = null
)

enum class MissionType {
    @Json(name = "LITTER_COLLECTION") LITTER_COLLECTION,
    @Json(name = "TREE_PLANTING") TREE_PLANTING,
    @Json(name = "BIO_DIVERSITY") BIO_DIVERSITY,
    @Json(name = "WATER_QUALITY") WATER_QUALITY,
    @Json(name = "RECYCLING") RECYCLING,
    @Json(name = "RESTORATION") RESTORATION;
    
    fun displayName(): String = when (this) {
        LITTER_COLLECTION -> "Litter Collection"
        TREE_PLANTING -> "Tree Planting"
        BIO_DIVERSITY -> "Biodiversity"
        WATER_QUALITY -> "Water Quality"
        RECYCLING -> "Recycling"
        RESTORATION -> "Restoration"
    }
}

enum class MissionStatus {
    @Json(name = "AVAILABLE") AVAILABLE,
    @Json(name = "CLAIMED") CLAIMED,
    @Json(name = "IN_PROGRESS") IN_PROGRESS,
    @Json(name = "PENDING_VERIFICATION") PENDING_VERIFICATION,
    @Json(name = "COMPLETED") COMPLETED,
    @Json(name = "EXPIRED") EXPIRED;
    
    fun displayName(): String = when (this) {
        AVAILABLE -> "Available"
        CLAIMED -> "Claimed"
        IN_PROGRESS -> "In Progress"
        PENDING_VERIFICATION -> "Pending Verification"
        COMPLETED -> "Completed"
        EXPIRED -> "Expired"
    }
}

@JsonClass(generateAdapter = true)
data class Evidence(
    @Json(name = "imageS3Key")
    val imageS3Key: String,
    @Json(name = "submittedAt")
    val submittedAt: String,
    val location: EvidenceLocation,
    @Json(name = "verificationStatus")
    val verificationStatus: VerificationStatus,
    @Json(name = "verificationResult")
    val verificationResult: VerificationResult? = null,
    @Json(name = "aiConfidence")
    val aiConfidence: Double? = null
)

@JsonClass(generateAdapter = true)
data class EvidenceLocation(
    val lat: Double,
    val lng: Double
)

enum class VerificationStatus {
    @Json(name = "PENDING") PENDING,
    @Json(name = "VERIFIED") VERIFIED,
    @Json(name = "REJECTED") REJECTED,
    @Json(name = "MANUAL_REVIEW") MANUAL_REVIEW
}

@JsonClass(generateAdapter = true)
data class VerificationResult(
    val labels: List<String> = emptyList(),
    val confidence: Double,
    @Json(name = "detectedObjects")
    val detectedObjects: List<DetectedObject> = emptyList(),
    @Json(name = "moderationFlags")
    val moderationFlags: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class DetectedObject(
    val name: String,
    val confidence: Double,
    @Json(name = "boundingBox")
    val boundingBox: BoundingBox? = null
)

@JsonClass(generateAdapter = true)
data class BoundingBox(
    val width: Double,
    val height: Double,
    val left: Double,
    val top: Double
)
