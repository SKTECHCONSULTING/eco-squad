package com.ecosquad.domain.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class User(
    val id: String,
    val email: String,
    val name: String,
    val avatar: String? = null,
    @Json(name = "totalImpactPoints")
    val totalImpactPoints: Int = 0,
    val squads: List<String> = emptyList(),
    @Json(name = "createdAt")
    val createdAt: String
)
