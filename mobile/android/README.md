# EcoSquad Android App

The Android mobile client for EcoSquad - an environmental micro-volunteering platform connecting field volunteers with location-based environmental missions.

## Architecture

The app follows **Clean Architecture** with **MVVM** pattern:

```
com.ecosquad/
├── data/           # Data layer (API, Repository implementations)
│   ├── remote/     # Retrofit API interface
│   └── repository/ # Repository implementations
├── domain/         # Domain layer (Models, Repository interfaces)
│   ├── model/      # Kotlin data classes
│   └── repository/ # Repository interfaces
├── presentation/   # UI layer (Compose, ViewModels)
│   ├── components/ # Reusable UI components
│   ├── screens/    # Screen composables
│   ├── theme/      # Material 3 theme
│   └── viewmodel/  # StateFlow-based ViewModels
└── di/             # Hilt dependency injection modules
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Language | Kotlin 1.9 |
| UI | Jetpack Compose + Material 3 |
| Architecture | MVVM + Clean Architecture |
| DI | Hilt 2.50 |
| Networking | Retrofit + Moshi |
| Async | Coroutines + Flow |
| Maps | Google Maps Compose |
| Camera | CameraX |
| Permissions | Accompanist |

## Features

- **Mission Discovery**: Browse and discover nearby environmental missions
- **Google Maps Integration**: View missions on an interactive map
- **Mission Claiming**: Claim available missions for your squad
- **Evidence Capture**: Take photos with CameraX to submit as mission evidence
- **Location Services**: Real-time location tracking for mission discovery
- **Bottom Navigation**: Easy navigation between Missions, Map, Squad, and Profile

## Setup

### Prerequisites

- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34

### Configuration

1. **Google Maps API Key**: Add to `local.properties`:
   ```properties
   MAPS_API_KEY=your_api_key_here
   ```

2. **API Base URL**: Update in `app/build.gradle.kts`:
   ```kotlin
   buildConfigField("String", "API_BASE_URL", "\"https://your-api.com/\"")
   ```

### Build

```bash
# Debug build
./gradlew assembleDebug

# Release build (requires keystore)
./gradlew assembleRelease

# Run tests
./gradlew test
```

## Project Structure

### Data Layer

- **EcoSquadApi.kt**: Retrofit interface for REST API calls
- **MissionRepositoryImpl.kt**: Mission data operations (remote + cache)
- **UserRepositoryImpl.kt**: User/squad data operations

### Domain Layer

- **Mission.kt**: Mission data class with enums for Type/Status
- **Squad.kt**: Squad and SquadMember models
- **ApiModels.kt**: Request/Response data classes and UI state sealed classes

### Presentation Layer

- **MainActivity.kt**: Entry point with bottom navigation
- **MissionListScreen.kt**: List view with pull-to-refresh
- **MapScreen.kt**: Google Maps with mission markers
- **MissionDetailScreen.kt**: Mission details, claim, and evidence submission
- **CameraScreen.kt**: CameraX-based photo capture
- **MissionViewModel.kt**: Mission operations with StateFlow
- **LocationViewModel.kt**: Location services management

## API Integration

The app connects to the EcoSquad backend API:

| Endpoint | Description |
|----------|-------------|
| `GET /api/missions` | Discover nearby missions |
| `GET /api/missions/{id}` | Get mission details |
| `POST /api/missions/{id}/claim` | Claim a mission |
| `POST /api/missions/{id}/submit-evidence` | Submit photo evidence |
| `GET /api/user/profile` | Get user profile |

## CI/CD

GitHub Actions workflow (`.github/workflows/android-build.yml`):

- **Build Job**: Lint, test, and build debug APK
- **Release Job**: Build signed release APK/AAB (main branch)
- **Code Quality**: Detekt static analysis

### Required Secrets

- `KEYSTORE_BASE64`: Base64-encoded keystore
- `KEYSTORE_PASSWORD`: Keystore password
- `KEY_ALIAS`: Signing key alias
- `KEY_PASSWORD`: Signing key password
- `MAPS_API_KEY`: Google Maps API key

## Permissions

The app requires the following permissions:

- **Location**: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION` - For mission discovery
- **Camera**: `CAMERA` - For evidence capture
- **Storage**: `READ_MEDIA_IMAGES` - For evidence upload (Android 13+)

## Testing

```bash
# Unit tests
./gradlew testDebugUnitTest

# Instrumented tests
./gradlew connectedDebugAndroidTest

# Code coverage
./gradlew jacocoTestReport
```

## Future Enhancements

- [ ] Offline support with Room database
- [ ] Push notifications for mission updates
- [ ] Image upload to S3
- [ ] Squad chat/messaging
- [ ] Impact statistics and leaderboards
- [ ] Dark mode support

## License

MIT License - EcoSquad Project
