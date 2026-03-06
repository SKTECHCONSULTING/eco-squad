package com.ecosquad.domain.repository

import com.ecosquad.domain.model.Result
import com.ecosquad.domain.model.Squad
import com.ecosquad.domain.model.User
import kotlinx.coroutines.flow.Flow

interface UserRepository {
    suspend fun getUserProfile(): Result<User>
    suspend fun getSquad(squadId: String): Result<Squad>
    suspend fun getUserMissions(): Result<List<com.ecosquad.domain.model.Mission>>
    
    // Local operations
    fun getCurrentUser(): Flow<User?>
    suspend fun saveUser(user: User)
    suspend fun clearUser()
}
