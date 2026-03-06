import SwiftUI
import CoreLocation

struct MissionListView: View {
    @State private var viewModel = MissionsViewModel()
    @State private var searchText = ""
    @State private var selectedType: MissionType?
    @State private var showFilterSheet = false
    
    var filteredMissions: [Mission] {
        var missions = viewModel.missions
        
        if let type = selectedType {
            missions = missions.filter { $0.type == type }
        }
        
        if !searchText.isEmpty {
            missions = viewModel.searchMissions(query: searchText)
        }
        
        return missions
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                List {
                    if !viewModel.availableMissions.isEmpty {
                        Section("Available Missions") {
                            ForEach(viewModel.availableMissions) { mission in
                                NavigationLink(value: mission) {
                                    MissionListItem(mission: mission, viewModel: viewModel)
                                }
                            }
                        }
                    }
                    
                    if !viewModel.claimedMissions.isEmpty {
                        Section("My Missions") {
                            ForEach(viewModel.claimedMissions) { mission in
                                NavigationLink(value: mission) {
                                    MissionListItem(mission: mission, viewModel: viewModel)
                                }
                            }
                        }
                    }
                    
                    if viewModel.missions.isEmpty && viewModel.loadingState != .loading {
                        Section {
                            EmptyStateView(
                                icon: "leaf.fill",
                                title: "No missions nearby",
                                message: "Pull to refresh or check the map for available missions."
                            )
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .refreshable {
                    await viewModel.refreshMissions()
                }
                .navigationTitle("Missions")
                .navigationDestination(for: Mission.self) { mission in
                    MissionDetailView(mission: mission)
                }
                .searchable(text: $searchText, prompt: "Search missions")
                
                if case .loading = viewModel.loadingState {
                    ProgressView()
                        .scaleEffect(1.5)
                        .progressViewStyle(CircularProgressViewStyle(tint: .green))
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showFilterSheet = true
                    } label: {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                    }
                }
            }
            .sheet(isPresented: $showFilterSheet) {
                MissionFilterSheet(selectedType: $selectedType)
            }
            .alert("Error", isPresented: .constant(viewModel.loadingState.errorMessage != nil)) {
                Button("OK") {
                    viewModel.loadingState = .idle
                }
            } message: {
                Text(viewModel.loadingState.errorMessage ?? "")
            }
        }
        .task {
            await viewModel.loadMissions()
        }
    }
}

// MARK: - Mission List Item

struct MissionListItem: View {
    let mission: Mission
    let viewModel: MissionsViewModel
    
    var body: some View {
        HStack(spacing: 12) {
            // Mission Type Icon
            ZStack {
                Circle()
                    .fill(Color(hex: mission.type.color).opacity(0.2))
                    .frame(width: 50, height: 50)
                
                Image(systemName: mission.type.icon)
                    .font(.system(size: 20))
                    .foregroundStyle(Color(hex: mission.type.color))
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(mission.title)
                    .font(.headline)
                    .lineLimit(1)
                
                Text(mission.type.displayName)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                HStack(spacing: 8) {
                    Label("\(mission.impactPoints)", systemImage: "star.fill")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                    
                    Text("•")
                        .foregroundStyle(.secondary)
                    
                    Text(viewModel.distanceToMission(mission))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            
            Spacer()
            
            // Status indicator
            StatusBadge(status: mission.status)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Status Badge

struct StatusBadge: View {
    let status: MissionStatus
    
    var body: some View {
        Text(status.displayName)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(backgroundColor)
            .foregroundColor(foregroundColor)
            .clipShape(Capsule())
    }
    
    private var backgroundColor: Color {
        switch status {
        case .available:
            return .green.opacity(0.2)
        case .claimed, .inProgress:
            return .blue.opacity(0.2)
        case .pendingVerification:
            return .orange.opacity(0.2)
        case .completed:
            return .purple.opacity(0.2)
        case .expired:
            return .gray.opacity(0.2)
        }
    }
    
    private var foregroundColor: Color {
        switch status {
        case .available:
            return .green
        case .claimed, .inProgress:
            return .blue
        case .pendingVerification:
            return .orange
        case .completed:
            return .purple
        case .expired:
            return .gray
        }
    }
}

// MARK: - Empty State View

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String
    
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: icon)
                .font(.system(size: 60))
                .foregroundStyle(.green.opacity(0.5))
            
            Text(title)
                .font(.headline)
                .foregroundStyle(.primary)
            
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, minHeight: 200)
        .padding()
    }
}

// MARK: - Mission Filter Sheet

struct MissionFilterSheet: View {
    @Binding var selectedType: MissionType?
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            List {
                Section("Filter by Type") {
                    Button {
                        selectedType = nil
                        dismiss()
                    } label: {
                        HStack {
                            Text("All Types")
                            Spacer()
                            if selectedType == nil {
                                Image(systemName: "checkmark")
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                    .foregroundStyle(.primary)
                    
                    ForEach(MissionType.allCases, id: \.self) { type in
                        Button {
                            selectedType = type
                            dismiss()
                        } label: {
                            HStack {
                                Image(systemName: type.icon)
                                    .foregroundStyle(Color(hex: type.color))
                                Text(type.displayName)
                                Spacer()
                                if selectedType == type {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.green)
                                }
                            }
                        }
                        .foregroundStyle(.primary)
                    }
                }
            }
            .navigationTitle("Filter Missions")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Loading State Helper

extension LoadingState {
    var errorMessage: String? {
        if case .error(let message) = self {
            return message
        }
        return nil
    }
}
