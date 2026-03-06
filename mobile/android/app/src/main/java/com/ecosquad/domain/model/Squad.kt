package com.ecosquad.domain.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Squad(
    val id: String,
    val name: String,
    val members: List<SquadMember> = emptyList(),
    @Json(name = "totalImpactPoints")
    val totalImpactPoints: Int = 0,
    @Json(name = "completedMissions")
    val completedMissions: Int = 0,
    @Json(name = "activeMissions")
    val activeMissions: Int? = null,
    @Json(name = "createdAt")
    val createdAt: String,
    @Json(name = "updatedAt")
    val updatedAt: String? = null
)

@JsonClass(generateAdapter = true)
data class SquadMember(
    @Json(name = "userId")
    val userId: String,
    val role: SquadRole,
    @Json(name = "joinedAt")
    val joinedAt: String
)

enum class SquadRole {
    @Json(name = "LEADER") LEADER,
    @Json(name = "MEMBER") MEMBER
}
