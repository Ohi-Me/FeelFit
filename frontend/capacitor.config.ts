import type { CapacitorConfig } from '@capacitor/cli';

// ─────────────────────────────────────────────────────────────────────────────
// FeelFit — Capacitor configuration
// One config drives BOTH Android and iOS. The webDir points to Next.js's
// static-export output (next.config.js → output: 'export').
// ─────────────────────────────────────────────────────────────────────────────
// Local-dev escape hatch: `CAP_DEV_HTTP=1 npx cap sync` lets the WebView call
// a plain-HTTP dev backend (e.g. emulator → http://10.0.2.2:8024). Production
// builds (the default) stay strictly HTTPS-only.
const DEV_HTTP = process.env.CAP_DEV_HTTP === '1';

const config: CapacitorConfig = {
  appId: 'app.feelfit.mobile',
  appName: 'FeelFit',
  webDir: 'out',
  // Run the WebView as a "server" so XHR/fetch, history.pushState, and
  // window.location.hash routing all work exactly like on the web.
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    // Cleartext = false: only allow HTTPS (unless CAP_DEV_HTTP=1, above).
    cleartext: DEV_HTTP,
  },
  // Hide the native splash immediately — BootSplash.tsx plays the branded
  // 2s health animation in the WebView, so the default Capacitor logo never
  // shows. Light background = no black flash during WebView boot.
  backgroundColor: '#f4f4f6',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#f4f4f6',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: false,
    },
    StatusBar: {
      // Default to dark icons on the light splash; we toggle at runtime in lib/native.ts.
      style: 'DARK',
      backgroundColor: '#0a0a0a',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'native',
      resizeOnFullScreen: true,
      style: 'DARK',
      scroll: 'ionic',
    },
    CapacitorNativeBiometric: {
      maxAttempts: 5,
      promptMessage: 'Authenticate to open FeelFit',
      fallbackButtonTitle: 'Use PIN',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#0a0a0a',
      sound: 'bell.wav',
    },
    Camera: {
      // Save full-res images to the gallery so the user can reuse them later.
      androidScaleType: 'CENTER_CROP',
      // iosNeedsPromptForGalleryAccess: true,
    },
  },
  android: {
    // Mixed content (https page → http fetch) is only allowed in dev-HTTP mode.
    allowMixedContent: DEV_HTTP,
    captureInput: true,
    webContentsDebuggingEnabled: DEV_HTTP, // dev builds are inspectable via chrome://inspect; production stays locked
  },
  ios: {
    contentInset: 'always',
    // Disable prefersHomeIndicatorAutoHidden so the home indicator stays visible.
    scrollEnabled: true,
    // Use WKWebView limitsDefaultPageLayoutToSafeArea so we get safe-area insets
    // for free in CSS env(safe-area-inset-*).
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
