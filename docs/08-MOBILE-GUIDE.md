# FeelFit — Capacitor Mobile App (Android + iOS)

A single shared Next.js codebase that ships as a **web app**, an **Android app**, and an **iOS app**.
Built on Capacitor 6 — no React Native, no Flutter, no frontend rewrite.

> 90–95 % of the original FeelFit frontend is reused verbatim. Mobile-only
> features (native camera, haptics, safe areas, bottom nav, pull-to-refresh,
> biometrics, push notifications, bottom-sheet modals, network status,
> tap-to-dismiss-keyboard) live behind a single typed abstraction
> (`lib/native.ts`) that gracefully degrades to web APIs when not inside
> Capacitor.
>
> **Performance:** 7 tab bodies (Medicine, Doctors, Symptoms, Tools, Dashboard,
> AskFit, About) are lazy-loaded via `React.lazy` + `Suspense`, cutting the
> initial First Load JS from 230 kB → 182 kB (−21 %). API host preconnect /
> dns-prefetch hints are emitted at HTML render time for ~100–300 ms faster
> cold-launch.

---

## 📦 What's in this bundle

```
FeelFit-Mobile-Bundle/
├── FeelFit-Original/        ← Your original Next.js + FastAPI project, untouched.
└── FeelFit-Mobile/          ← Capacitor-enabled Next.js app (this README).
    ├── app/                 ← Next.js App Router (1 route: app/page.tsx)
    ├── components/          ← All UI components from the original project
    │   ├── layout/
    │   │   ├── Navbar.tsx         (desktop nav — listens for ff:open-menu event)
    │   │   └── BottomNav.tsx      ★ Capacitor-only bottom tab bar
    │   │   └── NetworkStatus.tsx ★ Capacitor-only offline banner
    │   ├── hooks/                 ★ New: usePullToRefresh, useNativeBridge
    │   ├── ui/BottomSheet.tsx    ★ Capacitor-only slide-up sheet (used by Modal)
    │   ├── analyze/UploadPanel.tsx  (now wires native camera + gallery + file picker)
    │   ├── copilot/AskFit.tsx       (native document picker on Capacitor)
    │   └── ui/motion.tsx            (PageTransition auto-detects Capacitor for smoother slide)
    ├── lib/
    │   ├── api.ts            ← All API calls — now backed by native secure storage
    │   ├── native.ts         ★ Single typed entry point for every Capacitor plugin
    │   └── (firebase.ts, constants.ts, etc. — unchanged)
    ├── styles/
    │   ├── globals.css       ← Original design system (unchanged)
    │   └── mobile.css        ★ Capacitor-only layer (scoped under html.is-capacitor)
    ├── capacitor.config.ts   ← Single Capacitor config for Android + iOS
    ├── next.config.js        ← Static export when BUILD_TARGET=mobile, standalone otherwise
    ├── scripts/
    │   ├── prepare-mobile.mjs  ← Post-build: injects <base href="./"> into out/
    │   └── generate-icons.py   ← Generates app icons + splash PNGs from a script
    ├── android/              ← Native Android project (Capacitor-generated, permission-tuned)
    ├── ios/                  ← Native iOS project (Capacitor-generated, Info.plist-tuned)
    └── package.json
```

★ = new file added for the mobile build.

---

## 🚀 Quick start (local dev — web build)

```bash
cd FeelFit-Mobile
npm install --legacy-peer-deps
npm run dev          # http://localhost:3000 — works exactly like the original
```

The web build is 100 % backward-compatible with the original FeelFit — every
Capacitor-only code path returns early when `isCapacitor()` is false.

---

## 📱 Building the Android app

### Prerequisites
- **Android Studio** (Hedgehog 2023.1.1 or newer) — installs the Android SDK + JDK 17
- **Node.js 20+** (already installed if you're reading this from the dev box)
- An HTTPS-reachable backend (e.g. `https://api.feelfit.app`)

### One-time setup
```bash
cd FeelFit-Mobile
npm install --legacy-peer-deps
export BUILD_TARGET=mobile
export NEXT_PUBLIC_API_URL=https://api.feelfit.app
npx cap sync android       # builds Next.js (output: export) and copies to android/
```

### Run on a device / emulator
```bash
npx cap open android       # opens the project in Android Studio
                            # → click ▶ Run, or:
npm run mobile:run:android  # CLI: builds + syncs + runs on a connected device
```

### Build a release APK / AAB
Inside Android Studio:
1. **Build → Generate Signed Bundle / APK**
2. Create or select your keystore (`feelfit.keystore`)
3. Choose **release** variant
4. Output: `android/app/build/outputs/bundle/release/app-release.aab` (upload to Play Console)

Or from the CLI:
```bash
cd android
./gradlew assembleRelease    # → app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease      # → app/build/outputs/bundle/release/app-release.aab
```

---

## 🍎 Building the iOS app

### Prerequisites (macOS only — Xcode won't run anywhere else)
- **macOS 13+** (Ventura or newer)
- **Xcode 15+** with iOS 14+ SDK
- **CocoaPods** (`sudo gem install cocoapods` or `brew install cocoapods`)
- **Node.js 20+**
- A paid **Apple Developer account** ($99/year) to ship to TestFlight / App Store

### One-time setup
```bash
cd FeelFit-Mobile
npm install --legacy-peer-deps
export BUILD_TARGET=mobile
export NEXT_PUBLIC_API_URL=https://api.feelfit.app
npx cap sync ios           # builds Next.js and runs `pod install`
```

### Run on a device / simulator
```bash
npx cap open ios           # opens the .xcworkspace in Xcode
                           # → pick a team in Signing & Capabilities, then ▶ Run
npm run mobile:run:ios     # CLI: builds + syncs + runs on a booted simulator
```

### Archive for TestFlight / App Store
Inside Xcode:
1. **Product → Archive**
2. Window → Organizer → Distribute App → TestFlight or App Store Connect

---

## 🔌 Native features wired up

| Feature                | Plugin                                | Web fallback              |
|------------------------|---------------------------------------|---------------------------|
| Camera (Take Photo)    | `@capacitor/camera`                   | `<input capture>`         |
| Gallery picker         | `@capacitor/camera`                   | `<input type=file>`       |
| Document picker (PDF)  | `<input type=file>` (WebView-native)  | `<input type=file>`       |
| Haptics                | `@capacitor/haptics`                  | `navigator.vibrate`       |
| Status bar             | `@capacitor/status-bar`               | noop                      |
| Splash screen          | `@capacitor/splash-screen`            | noop                      |
| App lifecycle + back   | `@capacitor/app`                      | `popstate` listener       |
| Network status         | `@capacitor/network`                  | `online`/`offline` events |
| Device info            | `@capacitor/device`                   | `navigator.userAgent`     |
| Geolocation            | `@capacitor/geolocation`              | `navigator.geolocation`   |
| Clipboard              | `@capacitor/clipboard`                | `navigator.clipboard`     |
| Share sheet            | `@capacitor/share`                    | `navigator.share`         |
| Secure storage (token) | `@capacitor/preferences` (Keystore/Keychain) | `localStorage`     |
| Biometrics             | `@capgo/capacitor-native-biometric`   | (no-op)                   |
| Push notifications     | `@capacitor/push-notifications`       | Web Notifications API     |
| Local notifications    | `@capacitor/local-notifications`      | Web Notifications API     |
| In-app browser         | `@capacitor/browser`                  | `window.open`             |
| Toast (native)         | `@capacitor/toast`                    | (custom Toast component)  |
| Safe-area insets       | `@capacitor-community/safe-area`      | CSS `env()`               |

Every entry point is in **`lib/native.ts`** with full TypeScript types.

---

## 🎨 Mobile UX improvements (Capacitor-only — never affect the web build)

All mobile-only styles are scoped under `html.is-capacitor` in `styles/mobile.css`:

- **Safe-area insets** — content respects the notch, home indicator, and side insets
- **Bottom tab bar** — 5 primary destinations with a spring-in active pill (44 pt hit target)
- **Pull-to-refresh** — touch-driven, weighted, fires haptic on release
- **Native back button** (Android) — closes modals first, then navigates back, then exits
- **Keyboard avoidance** — `Keyboard.resize: 'native'` + global tap-to-dismiss listener
- **Touch targets ≥ 44 pt** — every button gets a min-height/min-width bump
- **Active-state feedback** — `:active { transform: scale(0.97) }` for instant tactile feel
- **Bottom-sheet modals** — every `<Modal>` auto-upgrades to a slide-up sheet on phones
  (with grabber handle, dimmed backdrop, spring physics) — see `components/ui/BottomSheet.tsx`
- **Full-screen modals** as a CSS fallback (`.ff-modal-shell`)
- **Font-size ≥ 16 px on inputs** — prevents iOS auto-zoom on focus
- **Hardware-accelerated page transitions** — `translate3d` + `will-change` for 60–120 FPS
- **Network status banner** — fixed-position red banner that floats above the navbar
  when the device loses connectivity; auto-hides on reconnect
- **Responsive grids** — 3-column hero preview, dashboard cards, plan picker, profile
  editor, and footer all stack to single-column at < 720 px viewport width
- **Accessibility focus rings** — every interactive control shows a 2 px outline on
  keyboard / VoiceOver focus
- **Reduced-motion respect** — FAB aura, page transitions, skeleton pulses all pause
  when `prefers-reduced-motion: reduce` is set

### Animation upgrades
`components/ui/motion.tsx` now branches on Capacitor:
- **Web:** snappy 320 ms cross-fade + 14 px rise (unchanged from original)
- **Capacitor:** 380 ms slide + fade + 8 px rise, `cubic-bezier(0.22, 1, 0.36, 1)` — feels like a native push

### Native authentication fallbacks
- **Google Sign-In** — on web uses Google Identity Services (GIS button); on Capacitor
  falls back to an OAuth redirect flow via the in-app browser because Google restricts
  GIS authorized origins to https URLs. (Backend must expose `/api/auth/google/mobile`.)
- **Phone OTP (Firebase)** — passes `isMobileNative: true` to `RecaptchaVerifier` to
  enable Firebase's device-aware flow. Shows a clear error if the mobile app's package
  ID isn't authorized in the Firebase console.

### Performance optimizations
- **Lazy-loaded tab bodies** — `MedicineTab`, `DoctorSection`, `SymptomChecker`,
  `HealthTools`, `DashboardTab`, `AskFit`, `AboutPage` are split into separate chunks
  via `React.lazy` + `<Suspense>`. A branded skeleton renders while each chunk loads.
- **API host preconnect** — `<link rel="preconnect">` + `dns-prefetch` emitted at
  HTML render time so the first `/api/usage` call doesn't pay the full TCP/TLS cost.
- **Bundle stats** — initial route: 93.9 kB / 182 kB First Load JS (was 142 kB / 230 kB
  before lazy-loading).

---

## 🔐 Security notes

- **HTTPS-only by default.** `capacitor.config.ts` sets `cleartext: false`; the Android
  `network_security_config.xml` only allows cleartext to `localhost` / `10.0.2.2` for dev.
- **Auth token** is stored in the OS keystore (Android Keystore / iOS Keychain) via
  `@capacitor/preferences`, mirrored to localStorage for legacy code paths.
- **No secrets in the bundle.** `NEXT_PUBLIC_*` vars are public by design (just like on the web);
  all sensitive work happens server-side in the FastAPI backend.
- **No JS debug bridge in release** — `webContentsDebuggingEnabled: false` in `capacitor.config.ts`.

---

## 🧱 Project scripts

```bash
npm run dev                  # Local dev (web)
npm run build                # Static export → out/ (when BUILD_TARGET=mobile)
npm run cap:sync             # Build + prepare + sync BOTH platforms
npm run cap:sync:android     # Build + prepare + sync Android only
npm run cap:sync:ios         # Build + prepare + sync iOS only
npm run mobile:run:android   # Build + sync + run on a connected Android device
npm run mobile:run:ios       # Build + sync + run on a booted iOS simulator
npx cap open android         # Open project in Android Studio
npx cap open ios             # Open project in Xcode
python3 scripts/generate-icons.py   # Regenerate app icons + splash PNGs
```

---

## ❓ Troubleshooting

### Build error: `Specified "headers" will not automatically work with "output: export"`
This is a **warning**, not an error — Next.js is informing you that custom
`headers()` are ignored in static-export mode (which is fine; security headers
are still applied by your FastAPI reverse proxy / CDN on the backend side).

### Android: `INSTALL_FAILED_NO_MATCHING_ABIS`
You're trying to install an x86 build on an ARM emulator (or vice versa). In
Android Studio: **Tools → SDK Manager → SDK Tools → NDK (Side by side)**,
then rebuild.

### iOS: `pod install` fails
Make sure CocoaPods is up to date:
```bash
sudo gem install cocoapods
cd ios/App
pod repo update
pod install
```

### Camera permission denied on first use
The Capacitor Camera plugin requests permission on first call. If the user
denied it earlier, send them to the OS settings page:
```ts
import { isCapacitor } from '@/lib/native';
if (isCapacitor()) {
  // Android: package name resolves to the app's settings page
  window.location.href = 'app-settings:';
}
```

### `cap sync` shows "Could not find the ios platform"
You haven't installed the iOS package yet:
```bash
npm install @capacitor/ios --legacy-peer-deps
npx cap add ios
```

---

## 🎯 Production checklist (before shipping)

- [ ] Set `NEXT_PUBLIC_API_URL` to your production HTTPS backend
- [ ] Set `BUILD_TARGET=mobile` (so `next.config.js` uses `output: 'export'`)
- [ ] Replace the placeholder app icons: `python3 scripts/generate-icons.py`
      (then drop in a designer-made `icon-1024.png` for the iOS App Store icon)
- [ ] Add your Firebase `GoogleService-Info.plist` (iOS) and `google-services.json`
      (Android) if you use push notifications
- [ ] Bump `versionCode` (Android) and `MARKETING_VERSION` (iOS) before each release
- [ ] Set the Android `signingConfig` in `android/app/build.gradle` for release builds
- [ ] In Xcode: pick a Team under Signing & Capabilities, then Archive

---

## 📜 License & credits

FeelFit is © 2026 FeelFit. Capacitor is © Ionic. All third-party plugins
retain their original licenses.
