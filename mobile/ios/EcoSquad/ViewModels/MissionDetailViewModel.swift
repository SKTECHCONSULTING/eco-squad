import Foundation
import SwiftUI
import CoreLocation

// MARK: - Mission Detail ViewModel

@Observable
final class MissionDetailViewModel {
    
    // MARK: - Properties
    
    private let apiService: APIServiceProtocol
    private let locationService: LocationServiceProtocol
    
    var mission: Mission
    var loadingState: LoadingState = .idle
    var showClaimConfirmation = false
    var showEvidenceCapture = false
    var claimErrorMessage: String?
    
    var canClaim: Bool {
        mission.isAvailable
    }
    
    var canSubmitEvidence: Bool {
        mission.isClaimed && mission.evidence == nil
    }
    
    var evidenceStatus: String? {
        guard let evidence = mission.evidence else { return nil }
        
        switch evidence.verificationStatus {
        case .pending:
            return "Pending Verification"
        case .verified:
            return "Verified ✓"
        case .rejected:
            return "Rejected ✗"
        case .manualReview:
            return "Under Manual Review"
        }
    }
    
    var formattedExpiryDate: String? {
        guard let expiresAt = mission.expiresAt else { return nil }
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: expiresAt) else { return nil }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        displayFormatter.timeStyle = .short
        return displayFormatter.string(from: date)
    }
    
    var isExpired: Bool {
        guard let expiresAt = mission.expiresAt else { return false }
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: expiresAt) else { return false }
        return date < Date()
    }
    
    // MARK: - Initialization
    
    init(
        mission: Mission,
        apiService: APIServiceProtocol = APIService.shared,
        locationService: LocationServiceProtocol = LocationService.shared
    ) {
        self.mission = mission
        self.apiService = apiService
        self.locationService = locationService
    }
    
    // MARK: - Actions
    
    func refreshMission() async {
        loadingState = .loading
        
        do {
            let updatedMission = try await apiService.getMission(id: mission.id)
            await MainActor.run {
                self.mission = updatedMission
                self.loadingState = .success
            }
        } catch {
            await MainActor.run {
                self.loadingState = .error("Failed to refresh mission")
            }
        }
    }
    
    func claimMission(squadId: String) async -> Bool {
        loadingState = .loading
        claimErrorMessage = nil
        
        do {
            let response = try await apiService.claimMission(id: mission.id, squadId: squadId)
            await MainActor.run {
                self.mission = response.mission
                self.loadingState = .success
            }
            return true
        } catch APIError.validationError(let message) {
            await MainActor.run {
                self.claimErrorMessage = message
                self.loadingState = .error(message)
            }
            return false
        } catch {
            await MainActor.run {
                self.claimErrorMessage = "Failed to claim mission"
                self.loadingState = .error("Failed to claim mission")
            }
            return false
        }
    }
    
    func submitEvidence(imageS3Key: String, location: CLLocationCoordinate2D) async -> Bool {
        loadingState = .loading
        
        do {
            let response = try await apiService.submitEvidence(
                missionId: mission.id,
                imageS3Key: imageS3Key,
                lat: location.latitude,
                lng: location.longitude
            )
            
            await MainActor.run {
                self.loadingState = .success
            }
            
            // Refresh mission to get updated status
            await refreshMission()
            
            return true
        } catch APIError.validationError(let message) {
            await MainActor.run {
                self.loadingState = .error(message)
            }
            return false
        } catch {
            await MainActor.run {
                self.loadingState = .error("Failed to submit evidence")
            }
            return false
        }
    }
    
    func distanceFromCurrentLocation() -> String? {
        let coordinate = CLLocationCoordinate2D(
            latitude: mission.location.lat,
            longitude: mission.location.lng
        )
        return locationService.formattedDistance(from: coordinate)
    }
    
    func isWithinCompletionRange() -> Bool {
        let coordinate = CLLocationCoordinate2D(
            latitude: mission.location.lat,
            longitude: mission.location.lng
        )
        
        // Must be within 500 meters to submit evidence
        if let distance = locationService.distance(from: coordinate) {
            return distance <= 500
        }
        
        return false
    }
}
