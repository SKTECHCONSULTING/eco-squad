import Foundation
import SwiftUI
import CoreLocation

// MARK: - Missions ViewModel

@Observable
final class MissionsViewModel {
    
    // MARK: - Properties
    
    private let apiService: APIServiceProtocol
    private let locationService: LocationServiceProtocol
    
    var missions: [Mission] = []
    var selectedMission: Mission?
    var loadingState: LoadingState = .idle
    var searchRadius: Int = 5000 // meters
    var isRefreshing = false
    
    var availableMissions: [Mission] {
        missions.filter { $0.isAvailable }
    }
    
    var claimedMissions: [Mission] {
        missions.filter { $0.isClaimed }
    }
    
    var completedMissions: [Mission] {
        missions.filter { $0.isCompleted }
    }
    
    // MARK: - Initialization
    
    init(
        apiService: APIServiceProtocol = APIService.shared,
        locationService: LocationServiceProtocol = LocationService.shared
    ) {
        self.apiService = apiService
        self.locationService = locationService
    }
    
    // MARK: - Actions
    
    func loadMissions() async {
        loadingState = .loading
        
        do {
            let location = try await locationService.getCurrentLocation()
            let missions = try await apiService.discoverMissions(
                lat: location.coordinate.latitude,
                lng: location.coordinate.longitude,
                radius: searchRadius
            )
            
            await MainActor.run {
                self.missions = missions
                self.loadingState = .success
            }
        } catch APIError.unauthorized {
            await MainActor.run {
                self.loadingState = .error("Please sign in to view missions")
            }
        } catch {
            await MainActor.run {
                self.loadingState = .error("Failed to load missions: \(error.localizedDescription)")
            }
        }
    }
    
    func refreshMissions() async {
        isRefreshing = true
        await loadMissions()
        isRefreshing = false
    }
    
    func loadMissionDetails(id: String) async {
        loadingState = .loading
        
        do {
            let mission = try await apiService.getMission(id: id)
            await MainActor.run {
                self.selectedMission = mission
                self.loadingState = .success
            }
        } catch {
            await MainActor.run {
                self.loadingState = .error("Failed to load mission details")
            }
        }
    }
    
    func claimMission(missionId: String, squadId: String) async -> Bool {
        loadingState = .loading
        
        do {
            let response = try await apiService.claimMission(id: missionId, squadId: squadId)
            await MainActor.run {
                if let index = self.missions.firstIndex(where: { $0.id == missionId }) {
                    self.missions[index] = response.mission
                }
                self.selectedMission = response.mission
                self.loadingState = .success
            }
            return true
        } catch APIError.validationError(let message) {
            await MainActor.run {
                self.loadingState = .error(message)
            }
            return false
        } catch {
            await MainActor.run {
                self.loadingState = .error("Failed to claim mission. Please try again.")
            }
            return false
        }
    }
    
    func filterMissions(by type: MissionType?) -> [Mission] {
        guard let type = type else { return missions }
        return missions.filter { $0.type == type }
    }
    
    func filterMissions(by status: MissionStatus) -> [Mission] {
        return missions.filter { $0.status == status }
    }
    
    func searchMissions(query: String) -> [Mission] {
        guard !query.isEmpty else { return missions }
        let lowercasedQuery = query.lowercased()
        return missions.filter {
            $0.title.lowercased().contains(lowercasedQuery) ||
            $0.description.lowercased().contains(lowercasedQuery) ||
            $0.tags.contains(where: { $0.lowercased().contains(lowercasedQuery) })
        }
    }
    
    func distanceToMission(_ mission: Mission) -> String {
        let coordinate = CLLocationCoordinate2D(
            latitude: mission.location.lat,
            longitude: mission.location.lng
        )
        
        if let distance = locationService.formattedDistance(from: coordinate) {
            return distance
        }
        return "Unknown distance"
    }
}
