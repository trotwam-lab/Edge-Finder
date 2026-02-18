import WidgetKit

/// Thin wrapper so main app code doesn't need to import WidgetKit directly
/// (WidgetKit is safe to import in the main app target as well).
enum WidgetKitService {
    static func reloadTimelines() {
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func reloadBetSummary() {
        WidgetCenter.shared.reloadTimelines(ofKind: "BetSummaryWidget")
    }
}
