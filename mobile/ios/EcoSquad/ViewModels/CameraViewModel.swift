import Foundation
import SwiftUI
import CoreLocation

// MARK: - Camera ViewModel

@Observable
final class CameraViewModel {
    
    // MARK: - Properties
    
    private let cameraService: CameraServiceProtocol
    private let locationService: LocationServiceProtocol
    private let apiService: APIServiceProtocol
    
    var capturedImage: UIImage?
    var capturedImageData: Data?
    var captureLocation: CLLocationCoordinate2D?
    
    var isCapturing = false
    var showPreview = false
    var showPermissionDenied = false
    
    var uploadState: LoadingState = .idle
    var uploadProgress: Double = 0
    
    var canCapture: Bool {
        cameraService.isAuthorized && !isCapturing
    }
    
    // MARK: - Initialization
    
    init(
        cameraService: CameraServiceProtocol = CameraService.shared,
        locationService: LocationServiceProtocol = LocationService.shared,
        apiService: APIServiceProtocol = APIService.shared
    ) {
        self.cameraService = cameraService
        self.locationService = locationService
        self.apiService = apiService
    }
    
    // MARK: - Setup
    
    func setupCamera() async {
        let authorized = await cameraService.requestAuthorization()
        
        if authorized {
            do {
                try await cameraService.setupCamera()
                cameraService.startSession()
            } catch {
                showPermissionDenied = true
            }
        } else {
            showPermissionDenied = true
        }
    }
    
    func stopCamera() {
        cameraService.stopSession()
    }
    
    // MARK: - Capture
    
    func capturePhoto() async {
        guard canCapture else { return }
        
        isCapturing = true
        
        // Get current location
        let location = locationService.getCurrentCoordinate()
        
        do {
            let result = try await cameraService.capturePhoto(location: location)
            
            await MainActor.run {
                self.capturedImage = UIImage(data: result.imageData)
                self.capturedImageData = result.imageData
                self.captureLocation = result.location
                self.showPreview = true
                self.isCapturing = false
            }
        } catch {
            await MainActor.run {
                self.isCapturing = false
            }
        }
    }
    
    func retakePhoto() {
        capturedImage = nil
        capturedImageData = nil
        captureLocation = nil
        showPreview = false
        uploadState = .idle
        uploadProgress = 0
    }
    
    // MARK: - Upload
    
    func uploadEvidence(missionId: String) async -> Bool {
        guard let imageData = capturedImageData,
              let location = captureLocation else {
            uploadState = .error("Missing image or location data")
            return false
        }
        
        uploadState = .loading
        uploadProgress = 0.3
        
        // Step 1: Process image (compress/resize if needed)
        let processedData = processImage(imageData)
        
        uploadProgress = 0.5
        
        // Step 2: Upload to S3 (presigned URL would come from backend)
        // For now, we'll simulate the S3 upload
        // In production, get presigned URL from API first
        
        // Step 3: Submit evidence with S3 key
        let imageS3Key = "evidence/\(missionId)/\(UUID().uuidString).jpg"
        
        do {
            uploadProgress = 0.8
            
            _ = try await apiService.submitEvidence(
                missionId: missionId,
                imageS3Key: imageS3Key,
                lat: location.latitude,
                lng: location.longitude
            )
            
            uploadProgress = 1.0
            uploadState = .success
            
            return true
        } catch APIError.validationError(let message) {
            await MainActor.run {
                self.uploadState = .error(message)
            }
            return false
        } catch {
            await MainActor.run {
                self.uploadState = .error("Failed to submit evidence")
            }
            return false
        }
    }
    
    private func processImage(_ imageData: Data) -> Data {
        // Compress image if needed
        let maxSizeMB: Double = 5
        let maxSizeBytes = maxSizeMB * 1024 * 1024
        
        if Double(imageData.count) > maxSizeBytes {
            // Compress
            guard let image = UIImage(data: imageData) else { return imageData }
            
            var compression: CGFloat = 0.9
            var compressedData = image.jpegData(compressionQuality: compression)
            
            while let data = compressedData,
                  Double(data.count) > maxSizeBytes && compression > 0.1 {
                compression -= 0.1
                compressedData = image.jpegData(compressionQuality: compression)
            }
            
            return compressedData ?? imageData
        }
        
        return imageData
    }
    
    // MARK: - Camera Controls
    
    func switchCamera() {
        cameraService.switchCamera()
    }
    
    func setFlashMode(_ mode: AVCaptureDevice.FlashMode) {
        cameraService.setFlashMode(mode)
    }
}
