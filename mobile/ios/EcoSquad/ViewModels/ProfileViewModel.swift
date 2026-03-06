import Foundation
import SwiftUI

// MARK: - Profile ViewModel

@Observable
final class ProfileViewModel {
    
    // MARK: - Properties
    
    private let apiService: APIServiceProtocol
    
    var user: User?
    var userSquads: [Squad] = []
    var loadingState: LoadingState = .idle
    
    var isSignedIn: Bool {
        user != nil
    }
    
    var displayName: String {
        user?.name ?? "Guest"
    }
    
    var email: String {
        user?.email ?? ""
    }
    
    var totalImpactPoints: Int {
        user?.totalImpactPoints ?? 0
    }
    
    var squadCount: Int {
        user?.squads.count ?? 0
    }
    
    var avatarURL: URL? {
        guard let avatar = user?.avatar else { return nil }
        return URL(string: avatar)
    }
    
    var memberSince: String {
        guard let createdAt = user?.createdAt else { return "Unknown" }
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: createdAt) else { return "Unknown" }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        return displayFormatter.string(from: date)
    }
    
    // MARK: - Initialization
    
    init(apiService: APIServiceProtocol = APIService.shared) {
        self.apiService = apiService
    }
    
    // MARK: - Actions
    
    func loadProfile(userId: String) async {
        loadingState = .loading
        
        do {
            let user = try await apiService.getUser(id: userId)
            await MainActor.run {
                self.user = user
                self.loadingState = .success
            }
            
            // Load user's squads
            await loadUserSquads(userId: userId)
        } catch APIError.unauthorized {
            await MainActor.run {
                self.loadingState = .error("Please sign in to view your profile")
            }
        } catch {
            await MainActor.run {
                self.loadingState = .error("Failed to load profile")
            }
        }
    }
    
    func loadUserSquads(userId: String) async {
        do {
            let squads = try await apiService.listSquads(userId: userId)
            await MainActor.run {
                self.userSquads = squads
            }
        } catch {
            // Non-critical error, don't update loading state
        }
    }
    
    func signOut() {
        // Clear auth token
        Task {
            await APIService.shared.setAuthToken(nil)
        }
        
        user = nil
        userSquads = []
        loadingState = .idle
    }
    
    func refreshProfile() async {
        guard let userId = user?.id else { return }
        await loadProfile(userId: userId)
    }
}

// MARK: - Auth ViewModel

@Observable
final class AuthViewModel {
    
    // MARK: - Properties
    
    var isAuthenticated = false
    var isLoading = false
    var errorMessage: String?
    
    // Sign in form
    var email = ""
    var password = ""
    
    // Sign up form
    var name = ""
    var confirmPassword = ""
    
    var showSignUp = false
    
    // MARK: - Computed Properties
    
    var canSignIn: Bool {
        !email.isEmpty && !password.isEmpty
    }
    
    var canSignUp: Bool {
        !name.isEmpty &&
        !email.isEmpty &&
        !password.isEmpty &&
        password == confirmPassword &&
        password.count >= 8
    }
    
    var passwordValidationMessage: String? {
        if password.isEmpty { return nil }
        if password.count < 8 {
            return "Password must be at least 8 characters"
        }
        if password != confirmPassword && !confirmPassword.isEmpty {
            return "Passwords do not match"
        }
        return nil
    }
    
    // MARK: - Actions
    
    func signIn() async -> Bool {
        guard canSignIn else {
            errorMessage = "Please enter email and password"
            return false
        }
        
        isLoading = true
        errorMessage = nil
        
        // In a real app, this would integrate with Cognito
        // For now, we'll simulate a successful sign-in
        // TODO: Implement Cognito authentication
        
        await Task.sleep(1_000_000_000) // Simulate network delay
        
        // Simulate successful sign-in with mock token
        let mockToken = "mock_jwt_token_\(UUID().uuidString)"
        await APIService.shared.setAuthToken(mockToken)
        
        isLoading = false
        isAuthenticated = true
        return true
    }
    
    func signUp() async -> Bool {
        guard canSignUp else {
            if password != confirmPassword {
                errorMessage = "Passwords do not match"
            } else if password.count < 8 {
                errorMessage = "Password must be at least 8 characters"
            } else {
                errorMessage = "Please fill in all fields"
            }
            return false
        }
        
        isLoading = true
        errorMessage = nil
        
        // In a real app, this would integrate with Cognito
        // TODO: Implement Cognito sign-up
        
        await Task.sleep(1_000_000_000) // Simulate network delay
        
        isLoading = false
        showSignUp = false
        errorMessage = "Account created! Please sign in."
        return true
    }
    
    func signOut() {
        Task {
            await APIService.shared.setAuthToken(nil)
        }
        isAuthenticated = false
        email = ""
        password = ""
        name = ""
        confirmPassword = ""
    }
    
    func resetForm() {
        email = ""
        password = ""
        name = ""
        confirmPassword = ""
        errorMessage = nil
    }
}
