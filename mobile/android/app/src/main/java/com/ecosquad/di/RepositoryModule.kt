package com.ecosquad.di

import com.ecosquad.data.repository.MissionRepositoryImpl
import com.ecosquad.data.repository.UserRepositoryImpl
import com.ecosquad.domain.repository.MissionRepository
import com.ecosquad.domain.repository.UserRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindMissionRepository(
        impl: MissionRepositoryImpl
    ): MissionRepository

    @Binds
    @Singleton
    abstract fun bindUserRepository(
        impl: UserRepositoryImpl
    ): UserRepository
}
