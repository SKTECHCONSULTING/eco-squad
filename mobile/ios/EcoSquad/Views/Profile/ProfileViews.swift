import SwiftUI

struct ProfileView: View {
    @State private var viewModel = ProfileViewModel()
    @Environment(AuthViewModel.self) private var authViewModel
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 24) {
                    // Profile Header
                    profileHeader
                    
                    // Stats Cards
                    statsSection
                    
                    // Squads Section
                    if !viewModel.userSquads.isEmpty {
                        mySquadsSection
                    }
                    
                    // Settings Section
                    settingsSection
                    
                    // Sign Out Button
                    Button {
                        authViewModel.signOut()
                    } label: {
                        HStack {
                            Spacer()
                            Image(systemName: "arrow.left.circle.fill")
                            Text("Sign Out")
                            Spacer()
                        }
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(.red)
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(.top)
                }
                .padding()
            }
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            await viewModel.refreshProfile()
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .task {
                // In a real app, get the actual user ID from auth
                await viewModel.loadProfile(userId: "current-user-id")
            }
        }
    }
    
    // MARK: - Profile Header
    
    private var profileHeader: some View {
        VStack(spacing: 16) {
            // Avatar
            ZStack {
                Circle()
                    .fill(Color.green.opacity(0.2))
                    .frame(width: 100, height: 100)
                
                if let avatarURL = viewModel.avatarURL {
                    AsyncImage(url: avatarURL) { image in
                        image
                            .resizable()
                            .scaledToFill()
                    } placeholder: {
                        Image(systemName: "person.fill")
                            .font(.system(size: 40))
                            .foregroundStyle(.green)
                    }
                    .frame(width: 100, height: 100)
                    .clipShape(Circle())
                } else {
                    Image(systemName: "person.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(.green)
                }
            }
            
            // Name and Email
            VStack(spacing: 4) {
                Text(viewModel.displayName)
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text(viewModel.email)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                Text("Member since \(viewModel.memberSince)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
            }
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 2)
    }
    
    // MARK: - Stats Section
    
    private var statsSection: some View {
        HStack(spacing: 16) {
            StatCard(
                title: "Impact Points",
                value: "\(viewModel.totalImpactPoints)",
                icon: "star.fill",
                color: .orange
            )
            
            StatCard(
                title: "Squads",
                value: "\(viewModel.squadCount)",
                icon: "person.3.fill",
                color: .blue
            )
        }
    }
    
    // MARK: - My Squads Section
    
    private var mySquadsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("My Squads")
                .font(.headline)
            
            VStack(spacing: 8) {
                ForEach(viewModel.userSquads.prefix(3)) { squad in
                    HStack {
                        Image(systemName: "leaf.fill")
                            .foregroundStyle(.green)
                        
                        Text(squad.name)
                            .font(.subheadline)
                        
                        Spacer()
                        
                        Label("\(squad.totalImpactPoints)", systemImage: "star.fill")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
            
            if viewModel.userSquads.count > 3 {
                NavigationLink {
                    SquadListView()
                } label: {
                    Text("View All Squads")
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }
            }
        }
    }
    
    // MARK: - Settings Section
    
    private var settingsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Settings")
                .font(.headline)
            
            VStack(spacing: 0) {
                NavigationLink {
                    Text("Notification Settings")
                } label: {
                    SettingsRow(icon: "bell.fill", title: "Notifications", color: .blue)
                }
                
                Divider()
                    .padding(.leading, 50)
                
                NavigationLink {
                    Text("Privacy Settings")
                } label: {
                    SettingsRow(icon: "shield.fill", title: "Privacy", color: .green)
                }
                
                Divider()
                    .padding(.leading, 50)
                
                NavigationLink {
                    Text("Help & Support")
                } label: {
                    SettingsRow(icon: "questionmark.circle.fill", title: "Help & Support", color: .orange)
                }
                
                Divider()
                    .padding(.leading, 50)
                
                NavigationLink {
                    Text("About EcoSquad")
                } label: {
                    SettingsRow(icon: "info.circle.fill", title: "About", color: .purple)
                }
            }
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }
}

// MARK: - Settings Row

struct SettingsRow: View {
    let icon: String
    let title: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(color)
                .frame(width: 30)
            
            Text(title)
                .font(.subheadline)
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .foregroundStyle(.primary)
    }
}

// MARK: - Auth View

struct AuthView: View {
    @State var viewModel = AuthViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                LinearGradient(
                    colors: [Color.green.opacity(0.3), Color.blue.opacity(0.2)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 32) {
                        // Logo
                        VStack(spacing: 16) {
                            ZStack {
                                Circle()
                                    .fill(Color.green)
                                    .frame(width: 100, height: 100)
                                    .shadow(radius: 10)
                                
                                Image(systemName: "leaf.fill")
                                    .font(.system(size: 50))
                                    .foregroundStyle(.white)
                            }
                            
                            Text("EcoSquad")
                                .font(.largeTitle)
                                .fontWeight(.bold)
                            
                            Text("Join the fight for a cleaner planet")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.top, 40)
                        
                        // Form
                        VStack(spacing: 20) {
                            if viewModel.showSignUp {
                                signUpForm
                            } else {
                                signInForm
                            }
                        }
                        .padding()
                        .background(.ultraThinMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 20))
                        .padding(.horizontal)
                        
                        // Toggle Sign In/Up
                        Button {
                            withAnimation {
                                viewModel.showSignUp.toggle()
                                viewModel.resetForm()
                            }
                        } label: {
                            Text(viewModel.showSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up")
                                .font(.subheadline)
                                .foregroundStyle(.green)
                        }
                        
                        Spacer()
                    }
                }
            }
            .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
                Button("OK") {
                    viewModel.errorMessage = nil
                }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }
    
    // MARK: - Sign In Form
    
    private var signInForm: some View {
        VStack(spacing: 20) {
            Text("Sign In")
                .font(.title2)
                .fontWeight(.bold)
            
            VStack(spacing: 16) {
                TextField("Email", text: $viewModel.email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .padding()
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                
                SecureField("Password", text: $viewModel.password)
                    .textContentType(.password)
                    .padding()
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            
            Button {
                Task {
                    await viewModel.signIn()
                }
            } label: {
                HStack {
                    Spacer()
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Sign In")
                            .font(.headline)
                            .fontWeight(.semibold)
                    }
                    Spacer()
                }
                .foregroundStyle(.white)
                .padding()
                .background(viewModel.canSignIn ? Color.green : Color.gray)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(!viewModel.canSignIn || viewModel.isLoading)
        }
    }
    
    // MARK: - Sign Up Form
    
    private var signUpForm: some View {
        VStack(spacing: 20) {
            Text("Create Account")
                .font(.title2)
                .fontWeight(.bold)
            
            VStack(spacing: 16) {
                TextField("Full Name", text: $viewModel.name)
                    .textContentType(.name)
                    .padding()
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                
                TextField("Email", text: $viewModel.email)
                    .textContentType(.emailAddress)
                    .keyboardType(.emailAddress)
                    .autocapitalization(.none)
                    .padding()
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                
                SecureField("Password", text: $viewModel.password)
                    .textContentType(.newPassword)
                    .padding()
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                
                SecureField("Confirm Password", text: $viewModel.confirmPassword)
                    .textContentType(.newPassword)
                    .padding()
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                
                if let validationMessage = viewModel.passwordValidationMessage {
                    Text(validationMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            
            Button {
                Task {
                    await viewModel.signUp()
                }
            } label: {
                HStack {
                    Spacer()
                    if viewModel.isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Create Account")
                            .font(.headline)
                            .fontWeight(.semibold)
                    }
                    Spacer()
                }
                .foregroundStyle(.white)
                .padding()
                .background(viewModel.canSignUp ? Color.green : Color.gray)
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .disabled(!viewModel.canSignUp || viewModel.isLoading)
        }
    }
}
