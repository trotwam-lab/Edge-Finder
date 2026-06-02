# EdgeFinder iOS App Notes

## What changed

- Added Capacitor so the React/Vite EdgeFinder app can run inside a native iOS shell.
- Generated the Xcode project under `ios/App`.
- Added iOS-ready app metadata and scripts:
  - `npm run ios:sync` builds the web app and copies it into iOS.
  - `npm run ios:open` builds, syncs, then opens Xcode.
- Added app icons and splash-screen art.
- Added mobile polish in `src/mobile.css`:
  - safe-area padding for iPhone notches/home indicator
  - better touch behavior
  - no horizontal page overflow
  - mobile bottom nav handling
  - larger mobile input font to prevent iOS zoom
- Made the Games filtering feel snappier by memoizing filtered games and deferring search input work.
- Preloads main secondary tabs while the browser is idle so tab switches feel faster after launch.

## How to run

```bash
npm run ios:sync
npm run ios:open
```

Then build/run from Xcode on an iPhone simulator or real device.

## Native build status

Xcode is now selected and the iOS app builds successfully for the iPhone simulator.

Verified commands:

```bash
npm run build
npx cap copy ios
xcodebuild -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17' \
  -derivedDataPath /tmp/edgefinder-derived \
  build
```

The app also installs and launches on the `iPhone 17` simulator.

## Capacitor / SwiftPM note

Xcode/SwiftPM was hanging while downloading Capacitor's remote binary artifacts from GitHub. To unblock local builds, `ios/App/CapApp-SPM/Package.swift` now points at local binary framework zips:

- `ios/App/CapApp-SPM/Binaries/Capacitor.xcframework.zip`
- `ios/App/CapApp-SPM/Binaries/Cordova.xcframework.zip`

If Xcode tries to fetch `capacitor-swift-pm` again, remove stale package pins:

```bash
rm -f ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
rm -f ios/App/CapApp-SPM/Package.resolved
```

Caution: `npx cap sync ios` may regenerate `ios/App/CapApp-SPM/Package.swift`. If it does, restore the local-binary Package.swift workaround before native builds.

## iOS launch polish

- Added a timeout fallback so Firebase auth cannot trap users on an infinite spinner.
- Added a small "Restoring sign-in…" label during auth restore.
- Improved the logged-out landing page on iPhone so the qualifier cards stack vertically instead of overflowing sideways.
- Added safe-area-aware spacing for the landing header and sign-in popup.

## Plain English

We did not rewrite EdgeFinder from scratch. We wrapped the current website/app in an iPhone app shell, got it building in Xcode, fixed the native dependency hang, and cleaned up the first iPhone launch experience so users actually reach the sign-in/landing screen.
