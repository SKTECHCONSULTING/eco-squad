# Task: Build iOS Mobile App for EcoSquad

## Overview
Build the iOS mobile client for field volunteers using SwiftUI.

## Repository
Local path: /home/ec2-user/.openclaw/workspace/eco-squad/mobile/ios

## What Exists
- Directory structure created
- No code yet

## Your Tasks
1. **Project Setup**:
   - Create Xcode project: EcoSquad.xcodeproj
   - Configure SwiftUI app lifecycle
   - Set up folder structure (Views, ViewModels, Models, Services)
   - Add required Info.plist permissions (Camera, Location)

2. **Models** (EcoSquad/Models/):
   - Mission.swift - Match TypeScript Mission type
   - Squad.swift - Squad model
   - User.swift - User model
   - Evidence.swift - Evidence submission model
   - API Response models

3. **Services** (EcoSquad/Services/):
   - APIService.swift - HTTP client with Alamofire or URLSession
   - LocationService.swift - CoreLocation integration
   - CameraService.swift - Camera capture and photo handling
   - AuthService.swift - Cognito authentication

4. **Views** (EcoSquad/Views/):
   - ContentView.swift - Main app shell with TabView
   - MissionMapView.swift - Map with mission pins
   - MissionListView.swift - List of nearby missions
   - MissionDetailView.swift - Mission details and claim button
   - CameraView.swift - Evidence capture
   - SquadView.swift - Squad management
   - ProfileView.swift - User profile

5. **ViewModels** (EcoSquad/ViewModels/):
   - MissionDiscoveryViewModel.swift
   - MissionDetailViewModel.swift
   - CameraViewModel.swift
   - SquadViewModel.swift

## Key Requirements
- iOS 16+ target
- SwiftUI for all UI
- MVVM architecture
- Async/await for networking
- CoreLocation for GPS
- Camera for evidence capture
- Offline mode support (cache missions)

## API Endpoints
- GET /api/missions?lat={lat}&lng={lng}&radius={r}
- POST /api/missions/{id}/claim
- POST /api/missions/{id}/submit-evidence

## Deliverables
- Complete Xcode project
- All Swift files for models, services, views
- Working map integration
- Camera functionality
- API integration

The app should compile and run in iOS Simulator.