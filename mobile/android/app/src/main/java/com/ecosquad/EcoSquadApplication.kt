package com.ecosquad

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class EcoSquadApplication : Application() {
    
    override fun onCreate() {
        super.onCreate()
        // App initialization
    }
}
