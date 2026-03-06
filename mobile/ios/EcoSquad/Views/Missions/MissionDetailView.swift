import SwiftUI
import MapKit

struct MissionDetailView: View {
    @State private var viewModel: MissionDetailViewModel
    @State private var showClaimConfirmation = false
    @State private var showEvidenceCapture = false
    @State private var selectedSquadId = ""
    
    // Mock squads - in real app would come from user's squads
    let mockSquads = [
        (id: "squad-1", name: "Green Warriors"),
        (id: "squad-2", name: "Eco Heroes")
    ]
    
    init(mission: Mission) {
        _viewModel = State(initialValue: MissionDetailViewModel(mission: mission))
    }
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header Card
                headerCard
                
                // Status Section
                statusSection
                
                Divider()
                
                // Description
                descriptionSection
                
                Divider()
                
                // Location Map
                locationSection
                
                Divider()
                
                // Evidence Section (if applicable)
                if viewModel.mission.evidence != nil || viewModel.canSubmitEvidence {
                    evidenceSection
                }
                
                // Tags
                if !viewModel.mission.tags.isEmpty {
                    tagsSection
                }
            }
            .padding()
        }
        .navigationTitle("Mission Details")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task {
                        await viewModel.refreshMission()
                    }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(viewModel.loadingState == .loading)
            }
        }
        .confirmationDialog(
            "Claim Mission",
            isPresented: $showClaimConfirmation,
            titleVisibility: .visible
        ) {
            ForEach(mockSquads, id: \.id) { squad in
                Button("Claim for \(squad.name)") {
                    Task {
                        await claimMission(squadId: squad.id)
                    }
                }
            }
            
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Select a squad to claim this mission for:")
        }
        .sheet(isPresented: $showEvidenceCapture) {
            EvidenceCaptureView(missionId: viewModel.mission.id) { success in
                if success {
                    Task {
                        await viewModel.refreshMission()
                    }
                }
            }
        }
        .alert("Error", isPresented: .constant(viewModel.loadingState.errorMessage != nil)) {
            Button("OK") {
                viewModel.loadingState = .idle
            }
        } message: {
            Text(viewModel.loadingState.errorMessage ?? "")
        }
    }
    
    // MARK: - Header Card
    
    private var headerCard: some View {
        HStack(spacing: 16) {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color(hex: viewModel.mission.type.color).opacity(0.2))
                    .frame(width: 80, height: 80)
                
                Image(systemName: viewModel.mission.type.icon)
                    .font(.system(size: 36))
                    .foregroundStyle(Color(hex: viewModel.mission.type.color))
            }
            
            VStack(alignment: .leading, spacing: 6) {
                Text(viewModel.mission.title)
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text(viewModel.mission.type.displayName)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                
                HStack(spacing: 12) {
                    Label("\(viewModel.mission.impactPoints)", systemImage: "star.fill")
                        .font(.subheadline)
                        .foregroundStyle(.orange)
                    
                    if let distance = viewModel.distanceFromCurrentLocation() {
                        Text("•")
                            .foregroundStyle(.secondary)
                        
                        Label(distance, systemImage: "location.fill")
                            .font(.subheadline)
                            .foregroundStyle(.green)
                    }
                }
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.1), radius: 8, x: 0, y: 2)
    }
    
    // MARK: - Status Section
    
    private var statusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Status")
                .font(.headline)
            
            HStack {
                StatusBadge(status: viewModel.mission.status)
                
                Spacer()
                
                if viewModel.canClaim {
                    Button {
                        showClaimConfirmation = true
                    } label: {
                        Text("Claim Mission")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(.green)
                            .clipShape(Capsule())
                    }
                    .disabled(viewModel.loadingState == .loading)
                }
            }
            
            if let expiryDate = viewModel.formattedExpiryDate {
                HStack {
                    Image(systemName: "clock")
                        .foregroundStyle(.orange)
                    Text("Expires: \(expiryDate)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            if let evidenceStatus = viewModel.evidenceStatus {
                HStack {
                    Image(systemName: "photo")
                        .foregroundStyle(.blue)
                    Text("Evidence: \(evidenceStatus)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
    
    // MARK: - Description Section
    
    private var descriptionSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Description")
                .font(.headline)
            
            Text(viewModel.mission.description)
                .font(.body)
                .foregroundStyle(.secondary)
                .lineSpacing(4)
        }
    }
    
    // MARK: - Location Section
    
    private var locationSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Location")
                .font(.headline)
            
            if let address = viewModel.mission.location.address {
                Label(address, systemImage: "mappin.circle.fill")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .padding(.bottom, 8)
            }
            
            Map(initialPosition: .region(MKCoordinateRegion(
                center: CLLocationCoordinate2D(
                    latitude: viewModel.mission.location.lat,
                    longitude: viewModel.mission.location.lng
                ),
                span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
            ))) {
                Marker(
                    viewModel.mission.title,
                    systemImage: viewModel.mission.type.icon,
                    coordinate: CLLocationCoordinate2D(
                        latitude: viewModel.mission.location.lat,
                        longitude: viewModel.mission.location.lng
                    )
                )
                .tint(Color(hex: viewModel.mission.type.color))
            }
            .frame(height: 200)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .mapStyle(.standard)
        }
    }
    
    // MARK: - Evidence Section
    
    private var evidenceSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Evidence")
                .font(.headline)
            
            if viewModel.canSubmitEvidence {
                VStack(spacing: 12) {
                    HStack {
                        Image(systemName: "camera.fill")
                            .font(.system(size: 30))
                            .foregroundStyle(.green)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Submit Evidence")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                            
                            if viewModel.isWithinCompletionRange() {
                                Text("Take a photo to complete this mission")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            } else {
                                Text("You must be within 500m to submit evidence")
                                    .font(.caption)
                                    .foregroundStyle(.orange)
                            }
                        }
                        
                        Spacer()
                    }
                    
                    Button {
                        showEvidenceCapture = true
                    } label: {
                        HStack {
                            Image(systemName: "camera")
                            Text("Capture Evidence")
                        }
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(viewModel.isWithinCompletionRange() ? .green : .gray)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .disabled(!viewModel.isWithinCompletionRange())
                }
                .padding()
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            
            if let evidence = viewModel.mission.evidence {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "photo.fill")
                        Text("Evidence Submitted")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        Spacer()
                        StatusBadge(status: mapVerificationStatus(evidence.verificationStatus))
                    }
                    
                    Text("Submitted on \(formatDate(evidence.submittedAt))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    
                    if let confidence = evidence.aiConfidence {
                        HStack {
                            Text("AI Confidence:")
                                .font(.caption)
                            ProgressView(value: confidence, total: 100)
                            Text("\(Int(confidence))%")
                                .font(.caption)
                                .monospacedDigit()
                        }
                    }
                }
                .padding()
                .background(Color(.systemGray6))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }
    
    // MARK: - Tags Section
    
    private var tagsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Tags")
                .font(.headline)
            
            FlowLayout(spacing: 8) {
                ForEach(viewModel.mission.tags, id: \.self) { tag in
                    Text(tag)
                        .font(.caption)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.green.opacity(0.15))
                        .foregroundStyle(.green)
                        .clipShape(Capsule())
                }
            }
        }
    }
    
    // MARK: - Actions
    
    private func claimMission(squadId: String) async {
        _ = await viewModel.claimMission(squadId: squadId)
    }
    
    // MARK: - Helpers
    
    private func formatDate(_ dateString: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let date = formatter.date(from: dateString) else { return dateString }
        
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .medium
        return displayFormatter.string(from: date)
    }
    
    private func mapVerificationStatus(_ status: VerificationStatus) -> MissionStatus {
        switch status {
        case .pending:
            return .pendingVerification
        case .verified:
            return .completed
        case .rejected:
            return .expired
        case .manualReview:
            return .pendingVerification
        }
    }
}

// MARK: - Evidence Capture View

struct EvidenceCaptureView: View {
    let missionId: String
    let onComplete: (Bool) -> Void
    
    @State private var viewModel = CameraViewModel()
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                if viewModel.showPreview, let image = viewModel.capturedImage {
                    // Preview captured image
                    VStack {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit
                            .frame(maxHeight: 400)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        
                        Spacer()
                        
                        VStack(spacing: 16) {
                            if let location = viewModel.captureLocation {
                                Label(
                                    String(format: "%.6f, %.6f", location.latitude, location.longitude),
                                    systemImage: "location.fill"
                                )
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            }
                            
                            if case .loading = viewModel.uploadState {
                                VStack(spacing: 8) {
                                    ProgressView(value: viewModel.uploadProgress)
                                        .progressViewStyle(LinearProgressViewStyle())
                                    Text("Uploading...")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            } else {
                                HStack(spacing: 20) {
                                    Button {
                                        viewModel.retakePhoto()
                                    } label: {
                                        Label("Retake", systemImage: "arrow.counterclockwise")
                                            .font(.subheadline)
                                    }
                                    .buttonStyle(.bordered)
                                    
                                    Button {
                                        Task {
                                            let success = await viewModel.uploadEvidence(missionId: missionId)
                                            onComplete(success)
                                            if success {
                                                dismiss()
                                            }
                                        }
                                    } label: {
                                        Label("Submit", systemImage: "checkmark.circle.fill")
                                            .font(.subheadline)
                                    }
                                    .buttonStyle(.borderedProminent)
                                    .tint(.green)
                                }
                            }
                        }
                        .padding()
                    }
                    .padding()
                } else {
                    // Camera preview
                    CameraPreviewView(viewModel: viewModel)
                        .ignoresSafeArea()
                    
                    VStack {
                        Spacer()
                        
                        HStack(spacing: 40) {
                            Button {
                                viewModel.switchCamera()
                            } label: {
                                Image(systemName: "camera.rotate")
                                    .font(.system(size: 24))
                                    .foregroundStyle(.white)
                            }
                            
                            Button {
                                Task {
                                    await viewModel.capturePhoto()
                                }
                            } label: {
                                ZStack {
                                    Circle()
                                        .fill(.white)
                                        .frame(width: 72, height: 72)
                                    
                                    Circle()
                                        .stroke(.white, lineWidth: 4)
                                        .frame(width: 80, height: 80)
                                }
                            }
                            .disabled(viewModel.isCapturing)
                            
                            Button {
                                dismiss()
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 24))
                                    .foregroundStyle(.white)
                            }
                        }
                        .padding(.bottom, 30)
                    }
                }
            }
            .navigationTitle("Capture Evidence")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundStyle(.white)
                }
            }
            .task {
                await viewModel.setupCamera()
            }
            .onDisappear {
                viewModel.stopCamera()
            }
            .alert("Camera Access Required", isPresented: $viewModel.showPermissionDenied) {
                Button("Open Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                Button("Cancel", role: .cancel) { }
            } message: {
                Text("Please allow camera access in Settings to capture evidence.")
            }
        }
    }
}

// MARK: - Camera Preview View

struct CameraPreviewView: UIViewRepresentable {
    let viewModel: CameraViewModel
    
    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: UIScreen.main.bounds)
        
        let previewLayer = AVCaptureVideoPreviewLayer(session: CameraService.shared.captureSession)
        previewLayer.frame = view.bounds
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
        
        return view
    }
    
    func updateUIView(_ uiView: UIView, context: Context) { }
}
