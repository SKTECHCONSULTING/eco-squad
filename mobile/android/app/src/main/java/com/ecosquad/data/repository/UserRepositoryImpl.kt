package com.ecosquad.data.repository

import com.ecosquad.data.remote.EcoSquadApi
import com.ecosquad.domain.model.Mission
import com.ecosquad.domain.model.Result
import com.ecosquad.domain.model.Squad
import com.ecosquad.domain.model.User
import com.ecosquad.domain.repository.UserRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserRepositoryImpl @Inject constructor(
    private val api: EcoSquadApi
) : UserRepository {

    private val _currentUser = MutableStateFlow<User?>(null)
    
    override suspend fun getUserProfile(): Result<User> {
        return try {
            val response = api.getUserProfile()
            if (response.isSuccessful) {
                response.body()?.let {
                    saveUser(it)
                    Result.Success(it)
                } ?: Result.Error("Empty response")
            } else {
                Result.Error(response.message(), response.code())
            }
        } catch (e: Exception) {
            Result.Error(e.message ?: "Unknown error")
        }
    }

    override suspend fun getSquad(squadId: String): Result<Squad> {
        return try {
            val response = api.getSquad(squadId)
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

    override suspend fun getUserMissions(): Result<List<Mission>> {
        return try {
            val response = api.getUserMissions()
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

    override fun getCurrentUser(): Flow<User?> = _currentUser.asStateFlow()

    override suspend fun saveUser(user: User) {
        _currentUser.value = user
    }

    override suspend fun clearUser() {
        _currentUser.value = null
    }
}
