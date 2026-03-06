import Foundation
import CoreLocation

// MARK: - Mission Types

enum MissionType: String, Codable, CaseIterable {
    case litterCollection = "LITTER_COLLECTION"
    case treePlanting = "TREE_PLANTING"
    case bioDiversity = "BIO_DIVERSITY"
    case waterQuality = "WATER_QUALITY"
    case recycling = "RECYCLING"
    case restoration = "RESTORATION"
    
    var displayName: String {
        switch self {
        case .litterCollection: return "Litter Collection"
        case .treePlanting: return "Tree Planting"
        case .bioDiversity: return "Biodiversity"
        case .waterQuality: return "Water Quality"
        case .recycling: return "Recycling"
        case .restoration: return "Restoration"
        }
    }
    
    var icon: String {
        switch self {
        case .litterCollection: return "trash.fill"
        case .treePlanting: return "tree.fill"
        case .bioDiversity: return "leaf.fill"
        case .waterQuality: return "drop.fill"
        case .recycling: return "arrow.3.trianglepath"
        case .restoration: return "sparkles"
        }
    }
    
    var color: String {
        switch self {
        case .litterCollection: return "#4CAF50"
        case .treePlanting: return "#2E7D32"
        case .bioDiversity: return "#66BB6A"
        case .waterQuality: return "#42A5F5"
        case .recycling: return "#FFA726"
        case .restoration: return "#AB47BC"
        }
    }
}

enum MissionStatus: String, Codable {
    case available = "AVAILABLE"
    case claimed = "CLAIMED"
    case inProgress = "IN_PROGRESS"
    case pendingVerification = "PENDING_VERIFICATION"
    case completed = "COMPLETED"
    case expired = "EXPIRED"
    
    var displayName: String {
        switch self {
        case .available: return "Available"
        case .claimed: return "Claimed"
        case .inProgress: return "In Progress"
        case .pendingVerification: return "Pending Verification"
        case .completed: return "Completed"
        case .expired: return "Expired"
        }
    }
}

// MARK: - Location

struct MissionLocation: Codable, Equatable {
    let lat: Double
    let lng: Double
    let geohash: String
    let address: String?
}

// MARK: - Evidence

enum VerificationStatus: String, Codable {
    case pending = "PENDING"
    case verified = "VERIFIED"
    case rejected = "REJECTED"
    case manualReview = "MANUAL_REVIEW"
}

struct BoundingBox: Codable {
    let width: Double
    let height: Double
    let left: Double
    let top: Double
}

struct DetectedObject: Codable {
    let name: String
    let confidence: Double
    let boundingBox: BoundingBox?
}

struct VerificationResult: Codable {
    let labels: [String]
    let confidence: Double
    let detectedObjects: [DetectedObject]
    let moderationFlags: [String]
}

struct Evidence: Codable {
    let imageS3Key: String
    let submittedAt: String
    let location: EvidenceLocation
    let verificationStatus: VerificationStatus
    let verificationResult: VerificationResult?
    let aiConfidence: Double?
}

struct EvidenceLocation: Codable {
    let lat: Double
    let lng: Double
}

// MARK: - Mission

struct Mission: Identifiable, Codable, Equatable {
    let id: String
    let title: String
    let description: String
    let type: MissionType
    let status: MissionStatus
    let location: MissionLocation
    let impactPoints: Int
    let createdAt: String
    let updatedAt: String?
    let expiresAt: String?
    let claimedBy: String?
    let claimedAt: String?
    let completedAt: String?
    let evidence: Evidence?
    let tags: [String]
    
    var isAvailable: Bool {
        status == .available
    }
    
    var isClaimed: Bool {
        status == .claimed || status == .inProgress
    }
    
    var isCompleted: Bool {
        status == .completed
    }
    
    var formattedDate: String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: createdAt) else { return "Unknown" }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        return displayFormatter.string(from: date)
    }
}

// MARK: - Squad

enum SquadMemberRole: String, Codable {
    case leader = "LEADER"
    case member = "MEMBER"
}

struct SquadMember: Codable, Identifiable {
    let userId: String
    let role: SquadMemberRole
    let joinedAt: String
    
    var id: String { userId }
    
    var isLeader: Bool {
        role == .leader
    }
}

struct Squad: Identifiable, Codable {
    let id: String
    let name: String
    let members: [SquadMember]
    let totalImpactPoints: Int
    let completedMissions: Int
    let activeMissions: Int?
    let createdAt: String
    let updatedAt: String?
    
    var memberCount: Int {
        members.count
    }
    
    var leaderId: String? {
        members.first { $0.isLeader }?.userId
    }
}

// MARK: - User

struct User: Identifiable, Codable {
    let id: String
    let email: String
    let name: String
    let avatar: String?
    let totalImpactPoints: Int
    let squads: [String]
    let createdAt: String
}

// MARK: - Organization

struct Organization: Identifiable, Codable {
    let id: String
    let name: String
    let description: String
    let missions: [String]
    let totalImpactPoints: Int
    let memberCount: Int
    let createdAt: String
}

// MARK: - API Request/Response Types

struct DiscoverMissionsRequest: Codable {
    let lat: Double
    let lng: Double
    let radius: Int
}

struct DiscoverMissionsResponse: Codable {
    let missions: [Mission]
    let total: Int
}

struct ClaimMissionRequest: Codable {
    let squadId: String
}

struct ClaimMissionResponse: Codable {
    let status: String
    let expiresAt: String
    let mission: Mission
}

struct SubmitEvidenceRequest: Codable {
    let imageS3Key: String
    let lat: Double
    let lng: Double
}

struct SubmitEvidenceResponse: Codable {
    let status: String
    let evidenceId: String
    let estimatedReviewTime: String
}

struct CreateSquadRequest: Codable {
    let name: String
    let memberIds: [String]
}

struct AddMemberRequest: Codable {
    let userId: String
    let role: SquadMemberRole?
}

// MARK: - Error Types

enum APIError: Error {
    case invalidURL
    case invalidResponse
    case decodingError(Error)
    case networkError(Error)
    case unauthorized
    case forbidden
    case notFound
    case serverError(Int)
    case rateLimited
    case validationError(String)
    
    var message: String {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .unauthorized:
            return "Please sign in to continue"
        case .forbidden:
            return "You don't have permission to do this"
        case .notFound:
            return "Resource not found"
        case .serverError(let code):
            return "Server error (\(code))"
        case .rateLimited:
            return "Too many requests. Please try again later"
        case .validationError(let msg):
            return msg
        }
    }
}

// MARK: - App State

enum LoadingState {
    case idle
    case loading
    case success
    case error(String)
}

// MARK: - Location Update

struct LocationUpdate: Equatable {
    let latitude: Double
    let longitude: Double
    let accuracy: Double
    let timestamp: Date
}

// MARK: - Camera Capture Result

struct CameraCaptureResult {
    let imageData: Data
    let location: CLLocationCoordinate2D?
    let timestamp: Date
}
