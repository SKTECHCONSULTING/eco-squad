import Foundation
import CoreLocation
import Combine

// MARK: - LocationService Protocol

protocol LocationServiceProtocol {
    var locationUpdates: AsyncStream<LocationUpdate> { get }
    var authorizationStatus: CLAuthorizationStatus { get }
    
    func requestAuthorization() async
    func startUpdatingLocation()
    func stopUpdatingLocation()
    func getCurrentLocation() async throws -> CLLocation
    func getCurrentCoordinate() -> CLLocationCoordinate2D?
    func distance(from coordinate: CLLocationCoordinate2D) -> CLLocationDistance?
}

// MARK: - LocationService Implementation

@Observable
final class LocationService: NSObject, LocationServiceProtocol {
    
    // MARK: - Properties
    
    static let shared = LocationService()
    
    private let locationManager: CLLocationManager
    private var locationContinuation: AsyncStream<LocationUpdate>.Continuation?
    private var locationRequestContinuation: CheckedContinuation<CLLocation, Error>?
    
    var locationUpdates: AsyncStream<LocationUpdate> {
        AsyncStream { continuation in
            self.locationContinuation = continuation
        }
    }
    
    var authorizationStatus: CLAuthorizationStatus {
        locationManager.authorizationStatus
    }
    
    var currentLocation: CLLocation? {
        locationManager.location
    }
    
    // MARK: - Initialization
    
    override init() {
        self.locationManager = CLLocationManager()
        super.init()
        self.locationManager.delegate = self
        self.locationManager.desiredAccuracy = kCLLocationAccuracyBest
        self.locationManager.distanceFilter = 10 // Update every 10 meters
        self.locationManager.allowsBackgroundLocationUpdates = false
        self.locationManager.pausesLocationUpdatesAutomatically = true
    }
    
    // MARK: - Authorization
    
    func requestAuthorization() async {
        let status = locationManager.authorizationStatus
        
        switch status {
        case .notDetermined:
            locationManager.requestWhenInUseAuthorization()
            // Wait for authorization response
            await withCheckedContinuation { continuation in
                Task {
                    while locationManager.authorizationStatus == .notDetermined {
                        try? await Task.sleep(nanoseconds: 100_000_000) // 100ms
                    }
                    continuation.resume()
                }
            }
        case .restricted, .denied:
            // User has denied access - can't do much here
            break
        case .authorizedWhenInUse, .authorizedAlways:
            // Already authorized
            break
        @unknown default:
            break
        }
    }
    
    // MARK: - Location Updates
    
    func startUpdatingLocation() {
        guard authorizationStatus == .authorizedWhenInUse ||
              authorizationStatus == .authorizedAlways else {
            return
        }
        locationManager.startUpdatingLocation()
    }
    
    func stopUpdatingLocation() {
        locationManager.stopUpdatingLocation()
    }
    
    // MARK: - Current Location
    
    func getCurrentLocation() async throws -> CLLocation {
        if let location = locationManager.location {
            return location
        }
        
        // Request a single location update
        return try await withCheckedThrowingContinuation { continuation in
            self.locationRequestContinuation = continuation
            locationManager.requestLocation()
        }
    }
    
    func getCurrentCoordinate() -> CLLocationCoordinate2D? {
        return locationManager.location?.coordinate
    }
    
    // MARK: - Distance Calculation
    
    func distance(from coordinate: CLLocationCoordinate2D) -> CLLocationDistance? {
        guard let currentLocation = locationManager.location else {
            return nil
        }
        
        let targetLocation = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        return currentLocation.distance(from: targetLocation)
    }
    
    func distanceInMeters(from coordinate: CLLocationCoordinate2D) -> Double? {
        distance(from: coordinate)
    }
    
    func formattedDistance(from coordinate: CLLocationCoordinate2D) -> String? {
        guard let distance = distance(from: coordinate) else {
            return nil
        }
        
        let formatter = LengthFormatter()
        formatter.unitStyle = .medium
        
        if distance < 1000 {
            return formatter.string(fromMeters: distance)
        } else {
            let kilometers = distance / 1000
            return String(format: "%.1f km", kilometers)
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationService: CLLocationManagerDelegate {
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        // Send to async stream
        let update = LocationUpdate(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude,
            accuracy: location.horizontalAccuracy,
            timestamp: location.timestamp
        )
        locationContinuation?.yield(update)
        
        // Fulfill any pending request
        locationRequestContinuation?.resume(returning: location)
        locationRequestContinuation = nil
    }
    
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        locationRequestContinuation?.resume(throwing: error)
        locationRequestContinuation = nil
    }
    
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            startUpdatingLocation()
        case .denied, .restricted, .notDetermined:
            stopUpdatingLocation()
        @unknown default:
            break
        }
    }
}

// MARK: - Location Permission Helper

enum LocationPermissionStatus {
    case notDetermined
    case denied
    case authorized
    
    var canAccessLocation: Bool {
        self == .authorized
    }
    
    var displayMessage: String {
        switch self {
        case .notDetermined:
            return "Location access is required to discover nearby missions."
        case .denied:
            return "Location access was denied. Please enable it in Settings to discover nearby missions."
        case .authorized:
            return "Location access granted."
        }
    }
}
