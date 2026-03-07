import Foundation

// MARK: - APIService Protocol

protocol APIServiceProtocol {
    func discoverMissions(lat: Double, lng: Double, radius: Int) async throws -> [Mission]
    func getMission(id: String) async throws -> Mission
    func claimMission(id: String, squadId: String) async throws -> ClaimMissionResponse
    func submitEvidence(missionId: String, imageS3Key: String, lat: Double, lng: Double) async throws -> SubmitEvidenceResponse
    func listSquads(userId: String?) async throws -> [Squad]
    func createSquad(name: String, memberIds: [String]) async throws -> Squad
    func getSquad(id: String) async throws -> Squad
    func updateSquad(id: String, name: String) async throws -> Squad
    func deleteSquad(id: String) async throws
    func addSquadMember(squadId: String, userId: String, role: SquadMemberRole?) async throws
    func removeSquadMember(squadId: String, userId: String) async throws
    func getUser(id: String) async throws -> User
}

// MARK: - APIService Implementation

actor APIService: APIServiceProtocol {
    
    // MARK: - Properties
    
    static let shared = APIService()
    
    private let baseURL: String
    private let session: URLSession
    private var authToken: String?
    
    // MARK: - Initialization
    
    init(baseURL: String? = nil, session: URLSession = .shared) {
        // Try to get from parameter, then Info.plist, then default
        if let providedURL = baseURL {
            self.baseURL = providedURL
        } else if let plistURL = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String {
            self.baseURL = plistURL
        } else {
            self.baseURL = "https://api.ecosquad.app"
        }
        self.session = session
    }
    
    // MARK: - Auth Token Management
    
    func setAuthToken(_ token: String?) {
        self.authToken = token
    }
    
    // MARK: - Request Builder
    
    private func buildRequest(
        path: String,
        method: String = "GET",
        queryItems: [URLQueryItem]? = nil,
        body: Encodable? = nil
    ) throws -> URLRequest {
        guard var components = URLComponents(string: baseURL) else {
            throw APIError.invalidURL
        }
        
        components.path = "/api" + path
        components.queryItems = queryItems
        
        guard let url = components.url else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        
        // Add auth token if available
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Add body if provided
        if let body = body {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            request.httpBody = try encoder.encode(body)
        }
        
        return request
    }
    
    // MARK: - Response Handler
    
    private func performRequest<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            decoder.dateDecodingStrategy = .iso8601
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
            
        case 401:
            throw APIError.unauthorized
            
        case 403:
            throw APIError.forbidden
            
        case 404:
            throw APIError.notFound
            
        case 429:
            throw APIError.rateLimited
            
        case 400...499:
            // Try to decode error message
            if let errorJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let error = errorJson["error"] as? [String: Any],
               let message = error["message"] as? String {
                throw APIError.validationError(message)
            }
            throw APIError.serverError(httpResponse.statusCode)
            
        default:
            throw APIError.serverError(httpResponse.statusCode)
        }
    }
    
    // MARK: - Missions
    
    func discoverMissions(lat: Double, lng: Double, radius: Int = 5000) async throws -> [Mission] {
        let queryItems = [
            URLQueryItem(name: "lat", value: String(lat)),
            URLQueryItem(name: "lng", value: String(lng)),
            URLQueryItem(name: "radius", value: String(radius))
        ]
        
        let request = try buildRequest(path: "/missions", queryItems: queryItems)
        let response: DiscoverMissionsResponse = try await performRequest(request)
        return response.missions
    }
    
    func getMission(id: String) async throws -> Mission {
        let request = try buildRequest(path: "/missions/\(id)")
        return try await performRequest(request)
    }
    
    func claimMission(id: String, squadId: String) async throws -> ClaimMissionResponse {
        let body = ClaimMissionRequest(squadId: squadId)
        let request = try buildRequest(path: "/missions/\(id)/claim", method: "POST", body: body)
        return try await performRequest(request)
    }
    
    func submitEvidence(
        missionId: String,
        imageS3Key: String,
        lat: Double,
        lng: Double
    ) async throws -> SubmitEvidenceResponse {
        let body = SubmitEvidenceRequest(imageS3Key: imageS3Key, lat: lat, lng: lng)
        let request = try buildRequest(
            path: "/missions/\(missionId)/submit-evidence",
            method: "POST",
            body: body
        )
        return try await performRequest(request)
    }
    
    // MARK: - Squads
    
    func listSquads(userId: String? = nil) async throws -> [Squad] {
        var queryItems: [URLQueryItem]?
        if let userId = userId {
            queryItems = [URLQueryItem(name: "userId", value: userId)]
        }
        
        let request = try buildRequest(path: "/squads", queryItems: queryItems)
        return try await performRequest(request)
    }
    
    func createSquad(name: String, memberIds: [String]) async throws -> Squad {
        let body = CreateSquadRequest(name: name, memberIds: memberIds)
        let request = try buildRequest(path: "/squads", method: "POST", body: body)
        return try await performRequest(request)
    }
    
    func getSquad(id: String) async throws -> Squad {
        let request = try buildRequest(path: "/squads/\(id)")
        return try await performRequest(request)
    }
    
    func updateSquad(id: String, name: String) async throws -> Squad {
        struct UpdateBody: Codable {
            let name: String
        }
        
        let body = UpdateBody(name: name)
        let request = try buildRequest(path: "/squads/\(id)", method: "PATCH", body: body)
        return try await performRequest(request)
    }
    
    func deleteSquad(id: String) async throws {
        let request = try buildRequest(path: "/squads/\(id)", method: "DELETE")
        let _: EmptyResponse = try await performRequest(request)
    }
    
    func addSquadMember(squadId: String, userId: String, role: SquadMemberRole? = nil) async throws {
        let body = AddMemberRequest(userId: userId, role: role)
        let request = try buildRequest(
            path: "/squads/\(squadId)/members",
            method: "POST",
            body: body
        )
        let _: EmptyResponse = try await performRequest(request)
    }
    
    func removeSquadMember(squadId: String, userId: String) async throws {
        var components = URLComponents(string: baseURL + "/api/squads/\(squadId)/members")!
        components.queryItems = [URLQueryItem(name: "userId", value: userId)]
        
        guard let url = components.url else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        let _: EmptyResponse = try await performRequest(request)
    }
    
    // MARK: - Users
    
    func getUser(id: String) async throws -> User {
        let request = try buildRequest(path: "/users/\(id)")
        return try await performRequest(request)
    }
    
    // MARK: - S3 Upload
    
    func uploadImageToS3(presignedUrl: String, imageData: Data) async throws {
        guard let url = URL(string: presignedUrl) else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
        request.httpBody = imageData
        
        let (_, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.serverError((response as? HTTPURLResponse)?.statusCode ?? 0)
        }
    }
}

// MARK: - Empty Response

struct EmptyResponse: Decodable {}
