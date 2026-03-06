package com.ecosquad.domain.model

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class Organization(
    val id: String,
    val name: String,
    val description: String,
    val missions: List<String> = emptyList(),
    @Json(name = "totalImpactPoints")
    val totalImpactPoints: Int = 0,
    @Json(name = "memberCount")
    val memberCount: Int = 0,
    @Json(name = "createdAt")
    val createdAt: String
)
