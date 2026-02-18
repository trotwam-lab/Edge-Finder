import Foundation

// MARK: - API Error

enum APIError: LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case serverError(Int, String)
    case networkError(Error)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidURL:          return "Invalid URL."
        case .noData:              return "No data received."
        case .decodingError(let e): return "Decoding failed: \(e.localizedDescription)"
        case .serverError(let c, let m): return "Server error \(c): \(m)"
        case .networkError(let e): return "Network error: \(e.localizedDescription)"
        case .unauthorized:        return "Session expired. Please sign in again."
        }
    }
}

// MARK: - API Service

final class APIService {
    static let shared = APIService()
    private init() {}

    // Replace with your actual EdgeFinder backend URL
    private let baseURL = "https://api.edgefinder-betting.com/v1"
    private var authToken: String? {
        UserDefaults.standard.string(forKey: "authToken")
    }

    // MARK: - Auth

    func signIn(email: String, password: String) async throws -> User {
        struct Body: Encodable { let email: String; let password: String }
        struct Response: Decodable { let token: String; let user: User }
        let body = Body(email: email, password: password)
        let response: Response = try await post(path: "/auth/signin", body: body)
        UserDefaults.standard.set(response.token, forKey: "authToken")
        return response.user
    }

    func signUp(username: String, email: String, password: String) async throws -> User {
        struct Body: Encodable { let username: String; let email: String; let password: String }
        struct Response: Decodable { let token: String; let user: User }
        let body = Body(username: username, email: email, password: password)
        let response: Response = try await post(path: "/auth/signup", body: body)
        UserDefaults.standard.set(response.token, forKey: "authToken")
        return response.user
    }

    // MARK: - Games & Odds

    func fetchGames(sport: Sport) async throws -> [Game] {
        try await get(path: "/games?sport=\(sport.rawValue)")
    }

    func fetchTrendingPicks(sport: Sport) async throws -> [TrendingPick] {
        try await get(path: "/picks/trending?sport=\(sport.rawValue)")
    }

    func fetchLiveScore(gameID: String, sport: Sport) async throws -> LiveScore {
        try await get(path: "/games/\(gameID)/score")
    }

    // MARK: - User

    func updateUserTheme(themeID: String) async throws {
        struct Body: Encodable { let themeID: String }
        let _: EmptyResponse = try await patch(path: "/user/theme", body: Body(themeID: themeID))
    }

    func updateNotificationPreferences(_ prefs: NotificationPreferences) async throws {
        let _: EmptyResponse = try await patch(path: "/user/notifications", body: prefs)
    }

    func upgradeToPro() async throws -> User {
        let _: EmptyResponse = try await post(path: "/user/upgrade", body: EmptyBody())
        return try await get(path: "/user/me")
    }

    // MARK: - Notifications & Live Activity

    func registerAPNsToken(_ token: String) async throws {
        struct Body: Encodable { let token: String; let platform: String }
        let _: EmptyResponse = try await post(path: "/push/register", body: Body(token: token, platform: "ios"))
    }

    func registerLiveActivityToken(betID: String, token: String) async throws {
        struct Body: Encodable { let betID: String; let token: String }
        let _: EmptyResponse = try await post(path: "/live-activity/register", body: Body(betID: betID, token: token))
    }

    // MARK: - Generic Request Helpers

    private func get<T: Decodable>(path: String) async throws -> T {
        guard let url = URL(string: baseURL + path) else { throw APIError.invalidURL }
        var request = URLRequest(url: url)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        return try await perform(request)
    }

    private func post<Body: Encodable, T: Decodable>(path: String, body: Body) async throws -> T {
        guard let url = URL(string: baseURL + path) else { throw APIError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(body)
        return try await perform(request)
    }

    private func patch<Body: Encodable, T: Decodable>(path: String, body: Body) async throws -> T {
        guard let url = URL(string: baseURL + path) else { throw APIError.invalidURL }
        var request = URLRequest(url: url)
        request.httpMethod = "PATCH"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(body)
        return try await perform(request)
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else { throw APIError.noData }

            switch httpResponse.statusCode {
            case 200...299:
                do {
                    return try JSONDecoder().decode(T.self, from: data)
                } catch {
                    throw APIError.decodingError(error)
                }
            case 401:
                UserDefaults.standard.removeObject(forKey: "authToken")
                throw APIError.unauthorized
            default:
                let message = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw APIError.serverError(httpResponse.statusCode, message)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }
}

// MARK: - Helpers

private struct EmptyResponse: Decodable {}
private struct EmptyBody: Encodable {}
