# EcoSquad iOS App

Native iOS application for EcoSquad environmental micro-volunteering platform, built with SwiftUI.

## Features

### Missions
- **Mission List**: Browse and filter available environmental missions
- **Mission Map**: Interactive map view showing nearby missions with location-based discovery
- **Mission Details**: Complete mission information with claim/evidence submission flow
- **Evidence Capture**: In-app camera integration for mission completion verification

### Squads
- **Squad Management**: Create and manage volunteer squads
- **Member Management**: Add/remove squad members with role assignment
- **Squad Stats**: Track collective impact points and completed missions

### Profile
- **User Profile**: View personal impact and mission history
- **Authentication**: Sign in/up with Cognito integration (ready)
- **Settings**: App preferences and account management

## Architecture

### MVVM Pattern
- **Models**: Swift structs matching backend TypeScript types
- **Views**: SwiftUI views with declarative UI
- **ViewModels**: Observable objects managing view state and business logic

### Services
- **APIService**: Async/await URLSession wrapper for REST API calls
- **LocationService**: CoreLocation integration for GPS and geofencing
- **CameraService**: AVFoundation camera capture for evidence

## Requirements

- iOS 17.0+
- Xcode 15.0+
- Swift 5.9+

## Project Structure

```
EcoSquad/
├── EcoSquad/
│   ├── Models/
│   │   └── MissionModels.swift      # Data models (Mission, Squad, User, etc.)
│   ├── Services/
│   │   ├── APIService.swift         # REST API client
│   │   ├── LocationService.swift    # CoreLocation service
│   │   └── CameraService.swift      # Camera capture service
│   ├── ViewModels/
│   │   ├── MissionsViewModel.swift
│   │   ├── MissionDetailViewModel.swift
│   │   ├── SquadsViewModel.swift
│   │   ├── ProfileViewModel.swift
│   │   └── CameraViewModel.swift
│   ├── Views/
│   │   ├── ContentView.swift        # App entry & tab navigation
│   │   ├── Missions/
│   │   │   ├── MissionListView.swift
│   │   │   ├── MissionMapView.swift
│   │   │   └── MissionDetailView.swift
│   │   ├── Squads/
│   │   │   └── SquadViews.swift
│   │   └── Profile/
│   │       └── ProfileViews.swift
│   ├── Utils/
│   │   └── Extensions.swift         # Swift extensions
│   └── Info.plist                   # App configuration & permissions
├── EcoSquad.xcodeproj/              # Xcode project
└── Package.swift                    # Swift Package Manager manifest
```

## Permissions

The app requires the following permissions (configured in `Info.plist`):

- **Camera**: For capturing mission evidence photos
- **Location When In Use**: For discovering nearby missions and verifying evidence location
- **Photo Library**: For uploading evidence from photo library

## Building

### Local Development

1. Open `EcoSquad.xcodeproj` in Xcode 15.0+
2. Select target device (iOS 17.0+ simulator or physical device)
3. Build and run (⌘+R)

### Remote Building (CI/CD)

The GitHub Actions workflow (`.github/workflows/ios-build.yml`) automatically builds the app on:
- Push to `main` or `develop` branches
- Pull requests to `main`

## API Configuration

The app connects to the EcoSquad backend API. Update the `baseURL` in `APIService.swift`:

```swift
init(baseURL: String = "https://api.ecosquad.app") { ... }
```

### Authentication

The app uses Bearer token authentication. Set the token after login:

```swift
await APIService.shared.setAuthToken("your-jwt-token")
```

## Key Technologies

- **SwiftUI**: Modern declarative UI framework
- **Observation Framework**: Reactive state management (@Observable)
- **Async/Await**: Modern Swift concurrency
- **MapKit**: Native maps integration
- **CoreLocation**: GPS and location services
- **AVFoundation**: Camera capture
- **URLSession**: Network requests

## Data Models

### Mission
```swift
struct Mission: Identifiable, Codable {
    let id: String
    let title: String
    let description: String
    let type: MissionType
    let status: MissionStatus
    let location: MissionLocation
    let impactPoints: Int
    // ...
}
```

### Squad
```swift
struct Squad: Identifiable, Codable {
    let id: String
    let name: String
    let members: [SquadMember]
    let totalImpactPoints: Int
    // ...
}
```

## Future Enhancements

- [ ] Push notifications for mission alerts
- [ ] Offline mission caching
- [ ] Siri shortcuts for quick mission check-in
- [ ] Widgets for mission status
- [ ] Apple Watch companion app
- [ ] iPad optimization

## License

Part of the EcoSquad platform - see root repository LICENSE.
