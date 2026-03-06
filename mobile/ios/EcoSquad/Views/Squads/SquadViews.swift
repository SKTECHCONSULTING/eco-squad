import SwiftUI

struct SquadListView: View {
    @State private var viewModel = SquadsViewModel()
    
    var body: some View {
        NavigationStack {
            ZStack {
                List {
                    if viewModel.squads.isEmpty && viewModel.loadingState != .loading {
                        Section {
                            EmptyStateView(
                                icon: "person.3.fill",
                                title: "No squads yet",
                                message: "Create a squad to start collaborating with others on environmental missions."
                            )
                        }
                    } else {
                        ForEach(viewModel.squads) { squad in
                            NavigationLink(value: squad) {
                                SquadListItem(squad: squad, viewModel: viewModel)
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .refreshable {
                    await viewModel.refreshSquads()
                }
                .navigationTitle("Squads")
                .navigationDestination(for: Squad.self) { squad in
                    SquadDetailView(squad: squad)
                }
                
                if case .loading = viewModel.loadingState {
                    ProgressView()
                        .scaleEffect(1.5)
                        .progressViewStyle(CircularProgressViewStyle(tint: .green))
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.showCreateSquadSheet = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                    }
                }
            }
            .sheet(isPresented: $viewModel.showCreateSquadSheet) {
                CreateSquadSheet(viewModel: viewModel)
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
            await viewModel.loadSquads()
        }
    }
}

// MARK: - Squad List Item

struct SquadListItem: View {
    let squad: Squad
    let viewModel: SquadsViewModel
    
    var body: some View {
        HStack(spacing: 12) {
            // Squad Icon
            ZStack {
                Circle()
                    .fill(Color.green.opacity(0.2))
                    .frame(width: 50, height: 50)
                
                Image(systemName: "leaf.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(.green)
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(squad.name)
                    .font(.headline)
                    .lineLimit(1)
                
                Text(viewModel.memberCountText(for: squad))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                HStack(spacing: 8) {
                    Label("\(squad.totalImpactPoints)", systemImage: "star.fill")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                    
                    Text("•")
                        .foregroundStyle(.secondary)
                    
                    Label("\(squad.completedMissions)", systemImage: "checkmark.circle.fill")
                        .font(.caption2)
                        .foregroundStyle(.green)
                }
            }
            
            Spacer()
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Squad Detail View

struct SquadDetailView: View {
    @State private var viewModel: SquadsViewModel
    @State private var showEditSquad = false
    @State private var showDeleteConfirmation = false
    @State private var editedName = ""
    
    let squad: Squad
    
    init(squad: Squad) {
        self.squad = squad
        _viewModel = State(initialValue: SquadsViewModel())
        _editedName = State(initialValue: squad.name)
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header Card
                headerCard
                
                Divider()
                
                // Stats Section
                statsSection
                
                Divider()
                
                // Members Section
                membersSection
                
                Divider()
                
                // Actions Section
                actionsSection
            }
            .padding()
        }
        .navigationTitle("Squad Details")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        showEditSquad = true
                    } label: {
                        Label("Edit Name", systemImage: "pencil")
                    }
                    
                    Button {
                        viewModel.showAddMemberSheet = true
                    } label: {
                        Label("Add Member", systemImage: "person.badge.plus")
                    }
                    
                    Divider()
                    
                    Button(role: .destructive) {
                        showDeleteConfirmation = true
                    } label: {
                        Label("Delete Squad", systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $viewModel.showAddMemberSheet) {
            AddMemberSheet(viewModel: viewModel, squadId: squad.id)
        }
        .alert("Edit Squad Name", isPresented: $showEditSquad) {
            TextField("Squad Name", text: $editedName)
            Button("Cancel", role: .cancel) { }
            Button("Save") {
                Task {
                    await viewModel.updateSquad(id: squad.id, name: editedName)
                }
            }
        } message: {
            Text("Enter a new name for your squad")
        }
        .alert("Delete Squad", isPresented: $showDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                Task {
                    let success = await viewModel.deleteSquad(id: squad.id)
                    if success {
                        // Navigation will handle dismissal
                    }
                }
            }
        } message: {
            Text("Are you sure you want to delete this squad? This action cannot be undone.")
        }
        .task {
            await viewModel.loadSquadDetails(id: squad.id)
        }
    }
    
    // MARK: - Header Card
    
    private var headerCard: some View {
        HStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.green.opacity(0.2))
                    .frame(width: 80, height: 80)
                
                Image(systemName: "leaf.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(.green)
            }
            
            VStack(alignment: .leading, spacing: 6) {
                Text(squad.name)
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text("Created \(formatDate(squad.createdAt))")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                
                Text(viewModel.memberCountText(for: squad))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 2)
    }
    
    // MARK: - Stats Section
    
    private var statsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Statistics")
                .font(.headline)
            
            HStack(spacing: 20) {
                StatCard(
                    title: "Impact Points",
                    value: "\(squad.totalImpactPoints)",
                    icon: "star.fill",
                    color: .orange
                )
                
                StatCard(
                    title: "Completed",
                    value: "\(squad.completedMissions)",
                    icon: "checkmark.circle.fill",
                    color: .green
                )
                
                if let active = squad.activeMissions {
                    StatCard(
                        title: "Active",
                        value: "\(active)",
                        icon: "bolt.fill",
                        color: .blue
                    )
                }
            }
        }
    }
    
    // MARK: - Members Section
    
    private var membersSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Members")
                    .font(.headline)
                
                Spacer()
                
                Button {
                    viewModel.showAddMemberSheet = true
                } label: {
                    Image(systemName: "person.badge.plus")
                        .foregroundStyle(.green)
                }
            }
            
            ForEach(squad.members) { member in
                MemberRow(member: member, isLeader: member.isLeader)
            }
        }
    }
    
    // MARK: - Actions Section
    
    private var actionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Actions")
                .font(.headline)
            
            VStack(spacing: 12) {
                NavigationLink {
                    MissionListView()
                } label: {
                    HStack {
                        Image(systemName: "list.bullet")
                        Text("Find Missions")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .foregroundStyle(.primary)
                
                Button {
                    viewModel.showAddMemberSheet = true
                } label: {
                    HStack {
                        Image(systemName: "person.badge.plus")
                        Text("Invite Members")
                        Spacer()
                        Image(systemName: "chevron.right")
                            .foregroundStyle(.secondary)
                    }
                    .padding()
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .foregroundStyle(.primary)
            }
        }
    }
    
    // MARK: - Helpers
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: dateString) else { return dateString }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        return displayFormatter.string(from: date)
    }
}

// MARK: - Stat Card

struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)
            
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
            
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Member Row

struct MemberRow: View {
    let member: SquadMember
    let isLeader: Bool
    
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(isLeader ? Color.orange.opacity(0.2) : Color.gray.opacity(0.2))
                    .frame(width: 40, height: 40)
                
                Image(systemName: isLeader ? "crown.fill" : "person.fill")
                    .font(.system(size: 16))
                    .foregroundStyle(isLeader ? .orange : .gray)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(member.userId)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                Text(member.isLeader ? "Leader" : "Member")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            Spacer()
            
            Text("Joined \(formatDate(member.joinedAt))")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: dateString) else { return dateString }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .short
        return displayFormatter.string(from: date)
    }
}

// MARK: - Create Squad Sheet

struct CreateSquadSheet: View {
    @State var viewModel: SquadsViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Squad Information") {
                    TextField("Squad Name", text: $viewModel.newSquadName)
                }
                
                if let error = viewModel.createSquadError {
                    Section {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
                
                Section {
                    Button {
                        Task {
                            let success = await viewModel.createSquad()
                            if success {
                                dismiss()
                            }
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if viewModel.loadingState == .loading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Create Squad")
                                    .fontWeight(.semibold)
                            }
                            Spacer()
                        }
                    }
                    .disabled(viewModel.newSquadName.isEmpty || viewModel.loadingState == .loading)
                }
                .listRowBackground(
                    viewModel.newSquadName.isEmpty ? Color.gray : Color.green
                )
                .foregroundStyle(.white)
            }
            .navigationTitle("Create Squad")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Add Member Sheet

struct AddMemberSheet: View {
    @State var viewModel: SquadsViewModel
    let squadId: String
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            Form {
                Section("Member Information") {
                    TextField("User ID", text: $viewModel.newMemberId)
                    
                    Picker("Role", selection: $viewModel.newMemberRole) {
                        Text("Member").tag(SquadMemberRole.member)
                        Text("Leader").tag(SquadMemberRole.leader)
                    }
                }
                
                if let error = viewModel.addMemberError {
                    Section {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }
                
                Section {
                    Button {
                        Task {
                            let success = await viewModel.addMember(
                                squadId: squadId,
                                userId: viewModel.newMemberId,
                                role: viewModel.newMemberRole
                            )
                            if success {
                                dismiss()
                            }
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if viewModel.loadingState == .loading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Add Member")
                                    .fontWeight(.semibold)
                            }
                            Spacer()
                        }
                    }
                    .disabled(viewModel.newMemberId.isEmpty || viewModel.loadingState == .loading)
                }
                .listRowBackground(
                    viewModel.newMemberId.isEmpty ? Color.gray : Color.green
                )
                .foregroundStyle(.white)
            }
            .navigationTitle("Add Member")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }
}
