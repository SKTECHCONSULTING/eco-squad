import Foundation
import AVFoundation
import UIKit
import CoreLocation

// MARK: - CameraService Protocol

protocol CameraServiceProtocol {
    var isAuthorized: Bool { get }
    var captureSession: AVCaptureSession { get }
    
    func requestAuthorization() async -> Bool
    func setupCamera() async throws
    func startSession()
    func stopSession()
    func capturePhoto(location: CLLocationCoordinate2D?) async throws -> CameraCaptureResult
    func switchCamera()
    func setFlashMode(_ mode: AVCaptureDevice.FlashMode)
}

// MARK: - Camera Errors

enum CameraError: Error {
    case permissionDenied
    case setupFailed
    case captureFailed
    case noCameraAvailable
    case invalidDevice
    case sessionNotRunning
    
    var message: String {
        switch self {
        case .permissionDenied:
            return "Camera access denied. Please enable it in Settings."
        case .setupFailed:
            return "Failed to set up camera."
        case .captureFailed:
            return "Failed to capture photo."
        case .noCameraAvailable:
            return "No camera available on this device."
        case .invalidDevice:
            return "Invalid camera device."
        case .sessionNotRunning:
            return "Camera session is not running."
        }
    }
}

// MARK: - CameraService Implementation

@Observable
final class CameraService: NSObject, CameraServiceProtocol {
    
    // MARK: - Properties
    
    static let shared = CameraService()
    
    let captureSession = AVCaptureSession()
    
    private var photoOutput: AVCapturePhotoOutput?
    private var videoDeviceInput: AVCaptureDeviceInput?
    private var currentCameraPosition: AVCaptureDevice.Position = .back
    private var photoCaptureContinuation: CheckedContinuation<CameraCaptureResult, Error>?
    private var currentCaptureLocation: CLLocationCoordinate2D?
    
    var isAuthorized: Bool {
        AVCaptureDevice.authorizationStatus(for: .video) == .authorized
    }
    
    var isSessionRunning: Bool {
        captureSession.isRunning
    }
    
    // MARK: - Initialization
    
    override init() {
        super.init()
    }
    
    // MARK: - Authorization
    
    func requestAuthorization() async -> Bool {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        
        switch status {
        case .authorized:
            return true
        case .notDetermined:
            return await AVCaptureDevice.requestAccess(for: .video)
        case .denied, .restricted:
            return false
        @unknown default:
            return false
        }
    }
    
    // MARK: - Setup
    
    func setupCamera() async throws {
        guard await requestAuthorization() else {
            throw CameraError.permissionDenied
        }
        
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }
        
        // Set preset for high quality photos
        captureSession.sessionPreset = .photo
        
        // Add video input
        try await configureVideoInput()
        
        // Add photo output
        try configurePhotoOutput()
    }
    
    private func configureVideoInput() async throws {
        guard let videoDevice = AVCaptureDevice.default(
            .builtInWideAngleCamera,
            for: .video,
            position: currentCameraPosition
        ) else {
            throw CameraError.noCameraAvailable
        }
        
        do {
            let videoInput = try AVCaptureDeviceInput(device: videoDevice)
            
            if captureSession.canAddInput(videoInput) {
                captureSession.addInput(videoInput)
                videoDeviceInput = videoInput
            } else {
                throw CameraError.setupFailed
            }
        } catch {
            throw CameraError.setupFailed
        }
    }
    
    private func configurePhotoOutput() throws {
        let photoOutput = AVCapturePhotoOutput()
        photoOutput.maxPhotoQualityPrioritization = .quality
        
        if captureSession.canAddOutput(photoOutput) {
            captureSession.addOutput(photoOutput)
            self.photoOutput = photoOutput
        } else {
            throw CameraError.setupFailed
        }
    }
    
    // MARK: - Session Control
    
    func startSession() {
        guard !captureSession.isRunning else { return }
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.startRunning()
        }
    }
    
    func stopSession() {
        guard captureSession.isRunning else { return }
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession.stopRunning()
        }
    }
    
    // MARK: - Camera Control
    
    func switchCamera() {
        guard let currentInput = videoDeviceInput else { return }
        
        captureSession.beginConfiguration()
        defer { captureSession.commitConfiguration() }
        
        // Remove current input
        captureSession.removeInput(currentInput)
        
        // Toggle position
        currentCameraPosition = currentCameraPosition == .back ? .front : .back
        
        // Add new input
        guard let newDevice = AVCaptureDevice.default(
            .builtInWideAngleCamera,
            for: .video,
            position: currentCameraPosition
        ) else { return }
        
        do {
            let newInput = try AVCaptureDeviceInput(device: newDevice)
            if captureSession.canAddInput(newInput) {
                captureSession.addInput(newInput)
                videoDeviceInput = newInput
            }
        } catch {
            // Restore previous input on failure
            if captureSession.canAddInput(currentInput) {
                captureSession.addInput(currentInput)
            }
        }
    }
    
    func setFlashMode(_ mode: AVCaptureDevice.FlashMode) {
        // Flash mode is set during capture, not on the device itself for photo output
    }
    
    // MARK: - Photo Capture
    
    func capturePhoto(location: CLLocationCoordinate2D? = nil) async throws -> CameraCaptureResult {
        guard captureSession.isRunning else {
            throw CameraError.sessionNotRunning
        }
        
        guard let photoOutput = photoOutput else {
            throw CameraError.setupFailed
        }
        
        self.currentCaptureLocation = location
        
        let settings = AVCapturePhotoSettings()
        settings.photoQualityPrioritization = .quality
        
        // Set flash mode based on device capabilities
        if let device = videoDeviceInput?.device,
           device.hasFlash {
            settings.flashMode = .auto
        }
        
        return try await withCheckedThrowingContinuation { continuation in
            self.photoCaptureContinuation = continuation
            photoOutput.capturePhoto(with: settings, delegate: self)
        }
    }
}

// MARK: - AVCapturePhotoCaptureDelegate

extension CameraService: AVCapturePhotoCaptureDelegate {
    
    func photoOutput(
        _ output: AVCapturePhotoOutput,
        didFinishProcessingPhoto photo: AVCapturePhoto,
        error: Error?
    ) {
        if let error = error {
            photoCaptureContinuation?.resume(throwing: error)
            photoCaptureContinuation = nil
            return
        }
        
        guard let imageData = photo.fileDataRepresentation() else {
            photoCaptureContinuation?.resume(throwing: CameraError.captureFailed)
            photoCaptureContinuation = nil
            return
        }
        
        let result = CameraCaptureResult(
            imageData: imageData,
            location: currentCaptureLocation,
            timestamp: Date()
        )
        
        photoCaptureContinuation?.resume(returning: result)
        photoCaptureContinuation = nil
    }
}

// MARK: - Image Processing

extension CameraService {
    
    func compressImage(_ imageData: Data, maxSizeMB: Double = 5) -> Data? {
        guard let image = UIImage(data: imageData) else { return nil }
        
        let maxSizeBytes = maxSizeMB * 1024 * 1024
        
        // Start with original quality
        var compression: CGFloat = 1.0
        var compressedData = image.jpegData(compressionQuality: compression)
        
        // Reduce quality until under max size or minimum quality reached
        while let data = compressedData, Double(data.count) > maxSizeBytes && compression > 0.1 {
            compression -= 0.1
            compressedData = image.jpegData(compressionQuality: compression)
        }
        
        return compressedData
    }
    
    func resizeImage(_ imageData: Data, maxDimension: CGFloat = 2048) -> Data? {
        guard let image = UIImage(data: imageData) else { return nil }
        
        let size = image.size
        
        // Check if resize is needed
        if size.width <= maxDimension && size.height <= maxDimension {
            return imageData
        }
        
        // Calculate new size maintaining aspect ratio
        let scale = min(maxDimension / size.width, maxDimension / size.height)
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        
        UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
        image.draw(in: CGRect(origin: .zero, size: newSize))
        let resizedImage = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        
        return resizedImage?.jpegData(compressionQuality: 0.9)
    }
}
