import Foundation
import Combine

@MainActor
final class UserViewModel: ObservableObject {
    @Published var currentUser: User? = nil
    @Published var isLoading: Bool = true
    @Published var isLoggedIn: Bool = false
    @Published var errorMessage: String? = nil

    private let apiService = APIService.shared
    private let persistence = UserPersistence.shared
    private var cancellables = Set<AnyCancellable>()

    init() {
        loadPersistedUser()
    }

    // MARK: - Auth

    func signIn(email: String, password: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let user = try await apiService.signIn(email: email, password: password)
            currentUser = user
            persistence.save(user)
            isLoggedIn = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signUp(username: String, email: String, password: String) async {
        isLoading = true
        defer { isLoading = false }
        do {
            let user = try await apiService.signUp(username: username, email: email, password: password)
            currentUser = user
            persistence.save(user)
            isLoggedIn = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() {
        currentUser = nil
        persistence.clear()
        isLoggedIn = false
        NotificationService.shared.cancelAllNotifications()
    }

    // MARK: - Theme (Pro)

    func setTheme(_ theme: AppTheme) {
        guard var user = currentUser else { return }
        guard user.isPro || !theme.isPro else {
            errorMessage = "Upgrade to Pro to unlock this theme."
            return
        }
        user.selectedThemeID = theme.id
        currentUser = user
        persistence.save(user)
        Task { try? await apiService.updateUserTheme(themeID: theme.id) }
    }

    // MARK: - Notifications

    func updateNotificationPreferences(_ prefs: NotificationPreferences) {
        guard var user = currentUser else { return }
        user.notificationPreferences = prefs
        currentUser = user
        persistence.save(user)
        Task { try? await apiService.updateNotificationPreferences(prefs) }
    }

    func setAPNsToken(_ token: String) {
        guard var user = currentUser else { return }
        user.apnsToken = token
        currentUser = user
        persistence.save(user)
        Task { try? await apiService.registerAPNsToken(token) }
    }

    // MARK: - Subscription

    func upgradeToPro() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let user = try await apiService.upgradeToPro()
            currentUser = user
            persistence.save(user)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Persistence

    private func loadPersistedUser() {
        if let user = persistence.load() {
            currentUser = user
            isLoggedIn = true
        }
        isLoading = false
    }
}
