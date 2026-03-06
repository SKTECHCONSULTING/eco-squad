import SwiftUI
import MapKit

struct MissionMapView: View {
    @State private var viewModel = MissionsViewModel()
    @State private var position: MapCameraPosition = .userLocation(fallback: .automatic)
    @State private var selectedMission: Mission?
    @State private var showMissionDetails = false
    @State private var mapStyle: MapStyle = .standard
    
    var body: some View {
        NavigationStack {
            ZStack {
                Map(position: $position) {
                    UserAnnotation()
                    
                    ForEach(viewModel.missions) { mission in
                        Marker(
                            mission.title,
                            systemImage: mission.type.icon,
                            coordinate: CLLocationCoordinate2D(
                                latitude: mission.location.lat,
                                longitude: mission.location.lng
                            )
                        )
                        .tint(mission.isAvailable ? Color(hex: mission.type.color) : .gray)
                    }
                }
                .mapStyle(mapStyle)
                .mapControls {
                    MapUserLocationButton()
                    MapCompass()
                    MapScaleView()
                }
                .onChange(of: selectedMission) { _, newValue in
                    if newValue != nil {
                        showMissionDetails = true
                    }
                }
                .sheet(isPresented: $showMissionDetails) {
                    if let mission = selectedMission {
                        MissionDetailSheet(mission: mission, viewModel: viewModel)
                    }
                }
                
                // Loading overlay
                if case .loading = viewModel.loadingState {
                    VStack {
                        Spacer()
                        ProgressView("Loading missions...")
                            .padding()
                            .background(.ultraThinMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                        Spacer()
                    }
                }
                
                // Refresh button
                VStack {
                    Spacer()
                    HStack {
                        Spacer()
                        Button {
                            Task {
                                await viewModel.loadMissions()
                            }
                        } label: {
                            Image(systemName: "arrow.clockwise")
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundStyle(.white)
                                .frame(width: 56, height: 56)
                                .background(.green)
                                .clipShape(Circle())
                                .shadow(radius: 4)
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Mission Map")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            mapStyle = .standard
                        } label: {
                            Label("Standard", systemImage: mapStyle == .standard ? "checkmark" : "")
                        }
                        
                        Button {
                            mapStyle = .hybrid
                        } label: {
                            Label("Hybrid", systemImage: mapStyle == .hybrid ? "checkmark" : "")
                        }
                        
                        Button {
                            mapStyle = .imagery
                        } label: {
                            Label("Satellite", systemImage: mapStyle == .imagery ? "checkmark" : "")
                        }
                    } label: {
                        Image(systemName: "map")
                    }
                }
            }
        }
        .task {
            await viewModel.loadMissions()
        }
    }
}

// MARK: - Mission Detail Sheet

struct MissionDetailSheet: View {
    let mission: Mission
    let viewModel: MissionsViewModel
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Header
                    HStack {
                        Image(systemName: mission.type.icon)
                            .font(.system(size: 40))
                            .foregroundStyle(Color(hex: mission.type.color))
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(mission.title)
                                .font(.title2)
                                .fontWeight(.bold)
                            
                            Text(mission.type.displayName)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        
                        Spacer()
                    }
                    
                    Divider()
                    
                    // Status and Points
                    HStack(spacing: 20) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Status")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            StatusBadge(status: mission.status)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Impact Points")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            Label("\(mission.impactPoints)", systemImage: "star.fill")
                                .font(.headline)
                                .foregroundStyle(.orange)
                        }
                        
                        Spacer()
                    }
                    
                    Divider()
                    
                    // Description
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Description")
                            .font(.headline)
                        Text(mission.description)
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                    
                    // Location
                    if let address = mission.location.address {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Location")
                                .font(.headline)
                            Label(address, systemImage: "mappin.and.ellipse")
                                .font(.body)
                                .foregroundStyle(.secondary)
                        }
                    }
                    
                    // Distance
                    HStack {
                        Image(systemName: "location.fill")
                            .foregroundStyle(.green)
                        Text(viewModel.distanceToMission(mission))
                            .font(.subheadline)
                    }
                    
                    // Tags
                    if !mission.tags.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Tags")
                                .font(.headline)
                            FlowLayout(spacing: 8) {
                                ForEach(mission.tags, id: \.self) { tag in
                                    Text(tag)
                                        .font(.caption)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 5)
                                        .background(Color.gray.opacity(0.2))
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    }
                    
                    Spacer()
                    
                    // Action Button
                    NavigationLink {
                        MissionDetailView(mission: mission)
                    } label: {
                        Text("View Full Details")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(.green)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding()
            }
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

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.replacingUnspecifiedDimensions().width, subviews: subviews, spacing: spacing)
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.positions[index].x,
                                      y: bounds.minY + result.positions[index].y),
                         proposal: .unspecified)
        }
    }
    
    struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []
        
        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var rowHeight: CGFloat = 0
            
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                
                if x + size.width > maxWidth && x > 0 {
                    x = 0
                    y += rowHeight + spacing
                    rowHeight = 0
                }
                
                positions.append(CGPoint(x: x, y: y))
                rowHeight = max(rowHeight, size.height)
                x += size.width + spacing
            }
            
            self.size = CGSize(width: maxWidth, height: y + rowHeight)
        }
    }
}
