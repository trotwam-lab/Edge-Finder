# CLAUDE.md - Edge-Finder

## Project Overview

**Edge-Finder** is a native iOS app for [EdgeFinder](https://edgefinder-betting.vercel.app/), a sports betting edge-finding platform.

- **Repository**: trotwam-lab/Edge-Finder
- **Status**: Active development — iOS app with lock screen Live Activities, push notifications, bet tracker, and Pro theme system
- **Branch strategy**: Feature branches prefixed with `claude/`
- **Language**: Swift 5.9 / SwiftUI
- **Minimum iOS**: 16.2 (required for Live Activities + lock screen widgets)

## Repository Structure

```
Edge-Finder/
├── CLAUDE.md
├── README.md
├── .gitignore
├── EdgeFinder/                         # Main app target
│   ├── App/                            # Entry point + AppDelegate
│   ├── Models/                         # Bet, Game, User, Theme
│   ├── Views/                          # SwiftUI views by feature
│   ├── ViewModels/                     # ObservableObject VMs
│   ├── Services/                       # LiveActivity, Notifications, API
│   ├── Utilities/                      # Persistence, WidgetKit helper
│   └── Resources/                      # Info.plist, entitlements
├── EdgeFinderWidget/                   # WidgetKit extension (Live Activity + widgets)
└── EdgeFinderNotificationService/      # Notification Service Extension
```

## Development Setup

- **Language**: Swift 5.9+
- **Package manager**: Xcode (no SPM packages yet — all Apple frameworks)
- **Runtime requirements**: Xcode 15+, iOS 16.2 simulator or device, Apple Developer Program account for APNs/Live Activities

## Common Commands

| Task         | Command |
|--------------|---------|
| Build        | `Cmd+B` in Xcode |
| Run          | `Cmd+R` (requires simulator or device) |
| Test         | `Cmd+U` |
| Lint         | `swiftlint` (not yet configured) |

## Architecture

- **Entry point**: `EdgeFinder/App/EdgeFinderApp.swift` (@main SwiftUI App)
- **Pattern**: MVVM — `@MainActor ObservableObject` ViewModels injected via `@EnvironmentObject`
- **Lock screen**: `EdgeFinderWidget/BetLiveActivityWidget.swift` (ActivityKit) + accessory widgets
- **Push notifications**: `NotificationService.swift` + `EdgeFinderNotificationService/` extension
- **Theming**: `AppTheme` propagated via `EnvironmentKey` — Pro users unlock additional color themes
- **Data flow**: API → ViewModel → View; bets persisted to App Group `UserDefaults` (shared with widget)
- **External services**: EdgeFinder REST API (`api.edgefinder-betting.com/v1`), APNs

## Conventions for AI Assistants

### General

- Read existing code before proposing changes. Never modify files you haven't read.
- Keep changes minimal and focused on the task at hand. Avoid unrelated refactors.
- Do not add features, abstractions, or error handling beyond what is requested.
- Do not introduce security vulnerabilities (command injection, XSS, SQL injection, etc.).
- Prefer editing existing files over creating new ones.

### Greenfield Guidelines

Since this project has no code yet, follow these principles when establishing the initial codebase:

- Choose simple, well-understood tools and frameworks. Avoid over-engineering.
- Add a `.gitignore` appropriate for the chosen language/runtime before committing generated or dependency files.
- Set up linting and formatting early so conventions are enforced from the start.
- Include a `README.md` only when there is meaningful content to put in it.
- Keep this `CLAUDE.md` up to date as the project structure evolves.

### Code Style

- Follow whatever linting/formatting configuration is established in the project.
- Match the style of surrounding code when making changes.
- Do not add comments, docstrings, or type annotations to code you didn't change.

### Git

- Write clear, concise commit messages that describe the "why" not the "what".
- Commit only the files relevant to the change.
- Do not commit secrets, credentials, or environment files.
- Use feature branches; do not push directly to `main` without explicit permission.

### Testing

- When tests exist, run them after making changes to verify nothing is broken.
- Add tests for new functionality when a testing framework is in place.
- Prefer fast, deterministic unit tests over slow integration tests where possible.

### Dependencies

- Do not add new dependencies without a clear need.
- Prefer well-maintained, widely-used packages when dependencies are necessary.
- Pin dependency versions to avoid unexpected breakage.
