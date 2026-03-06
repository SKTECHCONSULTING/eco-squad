import Foundation
import SwiftUI

// MARK: - Squads ViewModel

@Observable
final class SquadsViewModel {
    
    // MARK: - Properties
    
    private let apiService: APIServiceProtocol
    
    var squads: [Squad] = []
    var selectedSquad: Squad?
    var loadingState: LoadingState = .idle
    var isRefreshing = false
    
    var showCreateSquadSheet = false
    var showAddMemberSheet = false
    
    // Create squad form
    var newSquadName = ""
    var createSquadError: String?
    
    // Add member form
    var newMemberId = ""
    var newMemberRole: SquadMemberRole = .member
    var addMemberError: String?
    
    var mySquads: [Squad] {
        // Filter squads where current user is a member
        // In a real app, this would use the actual user ID
        squads
    }
    
    // MARK: - Initialization
    
    init(apiService: APIServiceProtocol = APIService.shared) {
        self.apiService = apiService
    }
    
    // MARK: - Actions
    
    func loadSquads(userId: String? = nil) async {
        loadingState = .loading
        
        do {
            let squads = try await apiService.listSquads(userId: userId)
            await MainActor.run {
                self.squads = squads
                self.loadingState = .success
            }
        } catch APIError.unauthorized {
            await MainActor.run {
                self.loadingState = .error("Please sign in to view squads")
            }
        } catch {
            await MainActor.run {
                self.loadingState = .error("Failed to load squads: \(error.localizedDescription)")
            }
        }
    }
    
    func refreshSquads() async {
        isRefreshing = true
        await loadSquads()
        isRefreshing = false
    }
    
    func loadSquadDetails(id: String) async {
        loadingState = .loading
        
        do {
            let squad = try await apiService.getSquad(id: id)
            await MainActor.run {
                self.selectedSquad = squad
                self.loadingState = .success
            }
        } catch {
            await MainActor.run {
                self.loadingState = .error("Failed to load squad details")
            }
        }
    }
    
    func createSquad() async -> Bool {
        guard !newSquadName.isEmpty else {
            createSquadError = "Please enter a squad name"
            return false
        }
        
        loadingState = .loading
        createSquadError = nil
        
        do {
            let squad = try await apiService.createSquad(
                name: newSquadName,
                memberIds: [] // Current user will be added automatically
            )
            
            await MainActor.run {
                self.squads.append(squad)
                self.newSquadName = ""
                self.loadingState = .success
                self.showCreateSquadSheet = false
            }
            return true
        } catch APIError.validationError(let message) {
            await MainActor.run {
                self.createSquadError = message
                self.loadingState = .error(message)
            }
            return false
        } catch {
            await MainActor.run {
                self.createSquadError = "Failed to create squad"
                self.loadingState = .error("Failed to create squad")
            }
            return false
        }
    }
    
    func updateSquad(id: String, name: String) async -> Bool {
        loadingState = .loading
        
        do {
            let updatedSquad = try await apiService.updateSquad(id: id, name: name)
            await MainActor.run {
                if let index = self.squads.firstIndex(where: { $0.id == id }) {
                    self.squads[index] = updatedSquad
                }
                self.selectedSquad = updatedSquad
                self.loadingState = .success
            }
            return true
        } catch {
            await MainActor.run {
                self.loadingState = .error("Failed to update squad")
            }
            return false
        }
    }
    
    func deleteSquad(id: String) async -> Bool {
        loadingState = .loading
        
        do {
            try await apiService.deleteSquad(id: id)
            await MainActor.run {
                self.squads.removeAll { $0.id == id }
                if self.selectedSquad?.id == id {
                    self.selectedSquad = nil
                }
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
                self.loadingState = .error("Failed to delete squad")
            }
            return false
        }
    }
    
    func addMember(squadId: String, userId: String, role: SquadMemberRole) async -> Bool {
        guard !userId.isEmpty else {
            addMemberError = "Please enter a user ID"
            return false
        }
        
        loadingState = .loading
        addMemberError = nil
        
        do {
            try await apiService.addSquadMember(squadId: squadId, userId: userId, role: role)
            
            // Refresh squad details
            await loadSquadDetails(id: squadId)
            
            await MainActor.run {
                self.newMemberId = ""
                self.newMemberRole = .member
                self.loadingState = .success
                self.showAddMemberSheet = false
            }
            return true
        } catch APIError.validationError(let message) {
            await MainActor.run {
                self.addMemberError = message
                self.loadingState = .error(message)
            }
            return false
        } catch {
            await MainActor.run {
                self.addMemberError = "Failed to add member"
                self.loadingState = .error("Failed to add member")
            }
            return false
        }
    }
    
    func removeMember(squadId: String, userId: String) async -> Bool {
        loadingState = .loading
        
        do {
            try await apiService.removeSquadMember(squadId: squadId, userId: userId)
            
            // Refresh squad details
            await loadSquadDetails(id: squadId)
            
            await MainActor.run {
                self.loadingState = .success
            }
            return true
        } catch {
            await MainActor.run {
                self.loadingState = .error("Failed to remove member")
            }
            return false
        }
    }
    
    func isLeader(_ squad: Squad, userId: String) -> Bool {
        squad.members.first { $0.userId == userId }?.isLeader ?? false
    }
    
    func memberCountText(for squad: Squad) -> String {
        let count = squad.memberCount
        return count == 1 ? "1 member" : "\(count) members"
    }
}
