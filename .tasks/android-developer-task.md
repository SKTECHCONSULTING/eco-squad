# Task: Build Android Mobile App for EcoSquad

## Overview
Build the Android mobile client for field volunteers using Kotlin and Jetpack Compose.

## Repository
Local path: /home/ec2-user/.openclaw/workspace/eco-squad/mobile/android

## What Exists
- Directory structure created
- No code yet

## Your Tasks
1. **Project Setup**:
   - Create Android Studio project with Jetpack Compose
   - Configure build.gradle with dependencies
   - Set up folder structure (ui, data, utils)
   - Add required permissions (Camera, Location)

2. **Data Layer** (EcoSquad/data/):
   - models/Mission.kt - Match TypeScript Mission type
   - models/Squad.kt, User.kt, Evidence.kt
   - repository/MissionRepository.kt
   - repository/AuthRepository.kt
   - remote/ApiService.kt - Retrofit API client
   - remote/LocationDataSource.kt

3. **UI Layer** (EcoSquad/ui/):
   - screens/MissionMapScreen.kt - Map with mission markers
   - screens/MissionListScreen.kt - List of missions
   - screens/MissionDetailScreen.kt - Details and claim
   - screens/CameraScreen.kt - Evidence capture
   - screens/SquadScreen.kt - Squad management
   - screens/ProfileScreen.kt - User profile
   - components/MissionCard.kt, LoadingSpinner.kt, etc.
   - viewmodels/MissionViewModel.kt, etc.

4. **Utils** (EcoSquad/utils/):
   - LocationHelper.kt - Location services
   - CameraHelper.kt - Camera functionality
   - PermissionHandler.kt - Runtime permissions

5. **Main Activity**:
   - MainActivity.kt with Compose setup
   - Navigation setup with Jetpack Navigation
   - Theme configuration

## Key Requirements
- Android API 26+ (Android 8.0)
- Kotlin coroutines for async
- Jetpack Compose for UI
- MVVM architecture
- Retrofit for networking
- Google Maps SDK
- CameraX for photos
- DataStore for local preferences

## API Endpoints
- GET /api/missions?lat={lat}&lng={lng}&radius={r}
- POST /api/missions/{id}/claim
- POST /api/missions/{id}/submit-evidence

## Dependencies
```kotlin
// Add to build.gradle
implementation("androidx.core:core-ktx:1.12.0")
implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")
implementation("androidx.activity:activity-compose:1.8.2")
implementation(platform("androidx.compose:compose-bom:2024.02.00"))
implementation("androidx.compose.ui:ui")
implementation("androidx.compose.ui:ui-graphics")
implementation("androidx.compose.ui:ui-tooling-preview")
implementation("androidx.compose.material3:material3")
implementation("androidx.navigation:navigation-compose:2.7.7")
implementation("com.squareup.retrofit2:retrofit:2.9.0")
implementation("com.squareup.retrofit2:converter-gson:2.9.0")
implementation("com.google.android.gms:play-services-maps:18.2.0")
implementation("androidx.camera:camera-core:1.3.1")
implementation("androidx.camera:camera-camera2:1.3.1")
implementation("androidx.camera:camera-lifecycle:1.3.1")
implementation("androidx.camera:camera-view:1.3.1")
```

## Deliverables
- Complete Android Studio project
- All Kotlin files for data, UI, utils
- Working map integration
- Camera functionality
- API integration

The app should compile and run in Android Emulator.