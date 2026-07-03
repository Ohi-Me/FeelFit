// ════════════════════════════════════════════════════════════════════════════
// FeelFit — Native bridge (lib/native.ts)
// ════════════════════════════════════════════════════════════════════════════
// A single, typed entry point for every native Capacitor capability used by
// the app. On the web, every method degrades gracefully to the equivalent
// browser API so the SAME code path works in Next.js dev, Vercel/Docker, and
// inside the Capacitor WebView.
//
// Design rules:
//  • Every export is async and never throws synchronously.
//  • On web, methods either (a) return a web-equivalent result, or (b) reject
//    with a clear Error so callers can branch.
//  • Detect Capacitor ONCE at module load; cache the result.
//  • All plugin imports are lazy (await import()) so the web bundle never
//    pays for code it can't use.
// ════════════════════════════════════════════════════════════════════════════

import type {
  AnalysisProfile,
} from '@/types';

// ── Platform detection ──────────────────────────────────────────────────────

let _isNative: boolean | null = null;

export function isCapacitor(): boolean {
  if (_isNative !== null) return _isNative;
  if (typeof window === 'undefined') return (_isNative = false);
  // The official marker injected by Capacitor's bridge.
  const anyWin = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };
  _isNative = !!(anyWin.Capacitor?.isNativePlatform?.());
  return _isNative;
}

export function platform(): 'android' | 'ios' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const anyWin = window as unknown as { Capacitor?: { getPlatform?: () => string } };
  const p = anyWin.Capacitor?.getPlatform?.();
  if (p === 'android' || p === 'ios') return p;
  // iOS Safari UA inside Capacitor still reports iPad/iPhone.
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return 'ios';
  if (/Android/.test(navigator.userAgent)) return 'android';
  return 'web';
}

export const isIOS = () => platform() === 'ios';
export const isAndroid = () => platform() === 'android';
export const isMobileWeb = () => !isCapacitor() && (isIOS() || isAndroid());

// Safe-area helpers — read once at boot, then cached.
export function safeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
  if (typeof window === 'undefined') return { top: 0, bottom: 0, left: 0, right: 0 };
  const root = getComputedStyle(document.documentElement);
  const n = (v: string) => parseFloat(v) || 0;
  return {
    top: n(root.getPropertyValue('--sat') || '0'),
    bottom: n(root.getPropertyValue('--sab') || '0'),
    left: n(root.getPropertyValue('--sal') || '0'),
    right: n(root.getPropertyValue('--sar') || '0'),
  };
}

// ── Haptics ─────────────────────────────────────────────────────────────────

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'select' | 'success' | 'warning' | 'error';

export async function haptic(style: HapticStyle = 'light'): Promise<void> {
  if (!isCapacitor()) {
    // Web fallback — best-effort Vibration API, ignored on desktop.
    try {
      const ms = style === 'heavy' ? 30 : style === 'medium' ? 18 : 10;
      navigator.vibrate?.(ms);
    } catch { /* noop */ }
    return;
  }
  try {
    const HapticsMod = await import('@capacitor/haptics');
    const { Haptics, NotificationType, ImpactStyle } = HapticsMod;
    if (style === 'success' || style === 'warning' || style === 'error') {
      const typeMap = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      } as const;
      await Haptics.notification({ type: typeMap[style] });
    } else {
      const impactMap = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
        select: ImpactStyle.Light,
      } as const;
      await Haptics.impact({ style: impactMap[style as 'light' | 'medium' | 'heavy' | 'select'] ?? ImpactStyle.Light });
    }
  } catch { /* noop */ }
}

// ── Status Bar ──────────────────────────────────────────────────────────────

export async function setStatusBarDark(): Promise<void> {
  if (!isCapacitor()) return;
  try {
    const SB = await import('@capacitor/status-bar');
    const { StatusBar, Style } = SB;
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0a0a0a' });
  } catch { /* noop */ }
}

export async function setStatusBarLight(): Promise<void> {
  if (!isCapacitor()) return;
  try {
    const SB = await import('@capacitor/status-bar');
    const { StatusBar, Style } = SB;
    await StatusBar.setStyle({ style: Style.Light });
    // Matches the app's light surface + native launch_background color.
    await StatusBar.setBackgroundColor({ color: '#f4f4f6' });
  } catch { /* noop */ }
}

// ── Splash Screen ───────────────────────────────────────────────────────────

export async function hideSplash(): Promise<void> {
  if (!isCapacitor()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 240 });
  } catch { /* noop */ }
}

// ── App lifecycle / back button ─────────────────────────────────────────────

export function onBackButton(handler: (canGoBack: boolean) => void): () => void {
  if (!isCapacitor()) return () => {};
  let remove: (() => void) | null = null;
  let cancelled = false;
  (async () => {
    try {
      const { App } = await import('@capacitor/app');
      if (cancelled) return; // cleanup ran while we were awaiting
      const listener = await App.addListener('backButton', ({ canGoBack }) => {
        handler(!!canGoBack);
      });
      if (cancelled) { // cleanup ran while we were awaiting addListener
        listener.remove();
        return;
      }
      remove = () => listener.remove();
    } catch { /* noop */ }
  })();
  return () => { cancelled = true; remove?.(); };
}

export function onAppStateChange(handler: (isActive: boolean) => void): () => void {
  if (!isCapacitor()) return () => {};
  let remove: (() => void) | null = null;
  let cancelled = false;
  (async () => {
    try {
      const { App } = await import('@capacitor/app');
      if (cancelled) return;
      const listener = await App.addListener('appStateChange', ({ isActive }) => handler(isActive));
      if (cancelled) { listener.remove(); return; }
      remove = () => listener.remove();
    } catch { /* noop */ }
  })();
  return () => { cancelled = true; remove?.(); };
}

export async function getAppInfo(): Promise<{ version: string; build: string; name: string }> {
  if (!isCapacitor()) return { version: 'web', build: 'web', name: 'FeelFit (Web)' };
  try {
    const { App } = await import('@capacitor/app');
    const info = await App.getInfo();
    return { version: info.version, build: info.build, name: info.name };
  } catch { return { version: '0', build: '0', name: 'FeelFit' }; }
}

// ── Network ─────────────────────────────────────────────────────────────────

export function onNetworkChange(handler: (connected: boolean, type: string) => void): () => void {
  if (!isCapacitor()) {
    const on = () => handler(navigator.onLine, 'wifi');
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }
  let remove: (() => void) | null = null;
  let cancelled = false;
  (async () => {
    try {
      const { Network } = await import('@capacitor/network');
      if (cancelled) return;
      const listener = await Network.addListener('networkStatusChange', s => handler(s.connected, s.connectionType));
      if (cancelled) { listener.remove(); return; }
      remove = () => listener.remove();
    } catch { /* noop */ }
  })();
  return () => { cancelled = true; remove?.(); };
}

export async function getNetworkStatus(): Promise<{ connected: boolean; type: string }> {
  if (!isCapacitor()) return { connected: navigator.onLine, type: 'wifi' };
  try {
    const { Network } = await import('@capacitor/network');
    const s = await Network.getStatus();
    return { connected: s.connected, type: s.connectionType };
  } catch { return { connected: navigator.onLine, type: 'unknown' }; }
}

// ── Device ──────────────────────────────────────────────────────────────────

export async function getDeviceInfo(): Promise<{
  platform: string; model: string; osVersion: string; manufacturer: string; isVirtual: boolean; id: string;
}> {
  if (!isCapacitor()) {
    return {
      platform: 'web', model: navigator.userAgent.slice(0, 60),
      osVersion: navigator.platform, manufacturer: 'web', isVirtual: false, id: 'web',
    };
  }
  try {
    const { Device } = await import('@capacitor/device');
    const d = await Device.getInfo();
    const id = await Device.getId();
    return { platform: d.platform, model: d.model, osVersion: d.osVersion, manufacturer: d.manufacturer, isVirtual: d.isVirtual, id: id.identifier };
  } catch { return { platform: 'web', model: 'unknown', osVersion: '0', manufacturer: 'unknown', isVirtual: false, id: 'unknown' }; }
}

// ── Camera / Gallery / File picker ──────────────────────────────────────────
//
// On Capacitor we use @capacitor/camera — it pops the native camera sheet
// (Take Photo · Choose from Library · Browse). On web we fall back to a
// synthetic <input type="file"> that supports both capture and selection.

export interface PickedFile {
  name: string;
  type: string;          // MIME
  size: number;
  blob: Blob;
  base64?: string;       // data URL (only used for image previews on Capacitor)
}

const MIME_FROM_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  csv: 'text/csv',
  webp: 'image/webp',
};

function guessMime(name: string, fallback = 'application/octet-stream'): string {
  const ext = name.toLowerCase().split('.').pop() || '';
  return MIME_FROM_EXT[ext] || fallback;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Pick a single image: opens the native Camera sheet on mobile. */
export async function pickImage(options?: { source?: 'camera' | 'gallery'; quality?: number }): Promise<PickedFile | null> {
  if (!isCapacitor()) {
    return await pickFileWeb(['image/jpeg', 'image/png', 'image/webp'], true);
  }
  try {
    const Cam = await import('@capacitor/camera');
    const { Camera, CameraResultType, CameraSource } = Cam;
    const sourceMap = {
      camera: CameraSource.Camera,
      gallery: CameraSource.Photos,
      prompt: CameraSource.Prompt,
    } as const;
    const srcKey = (options?.source ?? 'prompt') as 'camera' | 'gallery' | 'prompt';
    const photo = await Camera.getPhoto({
      quality: options?.quality ?? 92,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: sourceMap[srcKey],
      saveToGallery: options?.source === 'camera',
      correctOrientation: true,
      presentationStyle: 'popover',
    });
    const mime = `image/${photo.format || 'jpeg'}`;
    const base64 = `data:${mime};base64,${photo.base64String}`;
    const blob = dataUrlToBlob(base64);
    return {
      name: `report-${Date.now()}.${photo.format || 'jpg'}`,
      type: mime,
      size: blob.size,
      blob,
      base64,
    };
  } catch (e) {
    if ((e as Error).message?.includes('User cancelled') || (e as Error).message?.includes('cancelled')) return null;
    throw e;
  }
}

/** Pick a document (PDF / image / CSV) — uses native document picker on mobile. */
export async function pickDocument(accepted: string[] = ['application/pdf', 'image/jpeg', 'image/png', 'text/csv']): Promise<PickedFile | null> {
  if (!isCapacitor()) {
    return await pickFileWeb(accepted, false);
  }
  // On Capacitor, the most reliable cross-platform "any file" picker is
  // actually the same <input type="file"> the web uses — the WebView renders
  // the native Android document picker / iOS document picker automatically.
  return await pickFileWeb(accepted, false);
}

async function pickFileWeb(accepted: string[], capture: boolean): Promise<PickedFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accepted.join(',');
    if (capture) input.setAttribute('capture', 'environment');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.onchange = () => {
      const f = input.files?.[0];
      document.body.removeChild(input);
      if (!f) return resolve(null);
      resolve({
        name: f.name,
        type: f.type || guessMime(f.name),
        size: f.size,
        blob: f,
      });
    };
    input.onerror = () => { try { document.body.removeChild(input); } catch {} reject(new Error('File picker failed')); };
    document.body.appendChild(input);
    input.click();
  });
}

/** Convert a PickedFile to a File (for FormData uploads). */
export function toFile(p: PickedFile, overrideName?: string): File {
  const name = overrideName || p.name;
  // Blob → File constructor is universally supported.
  return new File([p.blob], name, { type: p.type });
}

// ── Clipboard ───────────────────────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<boolean> {
  if (!isCapacitor()) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }
  try {
    const { Clipboard } = await import('@capacitor/clipboard');
    await Clipboard.write({ string: text });
    return true;
  } catch { return false; }
}

// ── Share ───────────────────────────────────────────────────────────────────

export async function share(opts: { title?: string; text?: string; url?: string; }): Promise<boolean> {
  if (!isCapacitor()) {
    if (navigator.share) { try { await navigator.share(opts); return true; } catch { return false; } }
    if (opts.url) return copyToClipboard(opts.url);
    return false;
  }
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share(opts);
    return true;
  } catch { return false; }
}

// ── Secure storage (Preferences plugin — backed by Keystore/Keychain) ───────

const _memStore = new Map<string, string>();

export async function secureGet(key: string): Promise<string | null> {
  if (!isCapacitor()) {
    try { return localStorage.getItem(key); } catch { return _memStore.get(key) ?? null; }
  }
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key });
    return value;
  } catch {
    try { return localStorage.getItem(key); } catch { return null; }
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (!isCapacitor()) {
    try { localStorage.setItem(key, value); } catch { _memStore.set(key, value); }
    return;
  }
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
  } catch {
    try { localStorage.setItem(key, value); } catch { _memStore.set(key, value); }
  }
}

export async function secureRemove(key: string): Promise<void> {
  if (!isCapacitor()) {
    try { localStorage.removeItem(key); } catch { _memStore.delete(key); }
    return;
  }
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.remove({ key });
  } catch {
    try { localStorage.removeItem(key); } catch { /* noop */ }
  }
}

// ── Biometrics ──────────────────────────────────────────────────────────────

export async function biometricsAvailable(): Promise<{ available: boolean; biometryType?: number | string }> {
  if (!isCapacitor()) return { available: false };
  try {
    const mod = await import('@capgo/capacitor-native-biometric');
    const bio = mod.NativeBiometric ?? mod.default?.NativeBiometric;
    if (!bio) return { available: false };
    const r = await bio.isAvailable();
    return { available: r.isAvailable, biometryType: r.biometryType as unknown as number };
  } catch { return { available: false }; }
}

export async function biometricsVerify(reason = 'Open FeelFit'): Promise<boolean> {
  if (!isCapacitor()) return false;
  try {
    const mod = await import('@capgo/capacitor-native-biometric');
    const bio = mod.NativeBiometric ?? mod.default?.NativeBiometric;
    if (!bio) return false;
    await bio.verifyIdentity({ reason });
    return true;
  } catch { return false; }
}

// ── Push notifications ──────────────────────────────────────────────────────

export async function requestPushPermission(): Promise<boolean> {
  if (!isCapacitor()) {
    if (!('Notification' in window)) return false;
    const p = await Notification.requestPermission();
    return p === 'granted';
  }
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return false;
    await PushNotifications.register();
    return true;
  } catch { return false; }
}

export function onPushToken(handler: (token: string) => void): () => void {
  if (!isCapacitor()) return () => {};
  let remove: (() => void) | null = null;
  let cancelled = false;
  (async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      if (cancelled) return;
      const l = await PushNotifications.addListener('registration', t => handler(t.value));
      if (cancelled) { l.remove(); return; }
      remove = () => l.remove();
    } catch { /* noop */ }
  })();
  return () => { cancelled = true; remove?.(); };
}

export function onPushNotification(handler: (payload: unknown) => void): () => void {
  if (!isCapacitor()) return () => {};
  let remove: (() => void) | null = null;
  let cancelled = false;
  (async () => {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      if (cancelled) return;
      const l = await PushNotifications.addListener('pushNotificationReceived', n => handler(n));
      if (cancelled) { l.remove(); return; }
      remove = () => l.remove();
    } catch { /* noop */ }
  })();
  return () => { cancelled = true; remove?.(); };
}

// ── Local notifications (medication / retest reminders) ─────────────────────

export async function scheduleLocalNotification(opts: {
  title: string; body: string; at: Date; id?: number; smallIcon?: string;
}): Promise<number> {
  const id = opts.id ?? Math.floor(Math.random() * 1_000_000);
  if (!isCapacitor()) {
    if (!('Notification' in window)) return id;
    const ms = Math.max(0, opts.at.getTime() - Date.now());
    setTimeout(() => new Notification(opts.title, { body: opts.body }), ms);
    return id;
  }
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title: opts.title,
        body: opts.body,
        schedule: { at: opts.at },
        smallIcon: opts.smallIcon || 'ic_stat_icon',
      }],
    });
    return id;
  } catch { return id; }
}

export async function cancelLocalNotification(id: number): Promise<void> {
  if (!isCapacitor()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch { /* noop */ }
}

// ── Browser (open external links inside the in-app browser) ─────────────────

export async function openExternal(url: string): Promise<void> {
  if (!isCapacitor()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, windowName: '_blank' });
  } catch { window.open(url, '_blank', 'noopener,noreferrer'); }
}

// ── URL-scheme-aware link opener ─────────────────────────────────────────────
// On Capacitor, `<a href="tel:...">` / `<a href="mailto:...">` / `<a href="geo:...">`
// are not natively handled by the WebView — we need to forward them to the OS
// via window.open with the right scheme. The App plugin also exposes a method
// for opening "system" URLs that we use as a fallback.

export async function openLink(url: string): Promise<void> {
  // tel:, mailto:, sms:, geo:, maps:, external https URLs — all routed through here.
  if (!isCapacitor()) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  const scheme = url.split(':')[0]?.toLowerCase();
  if (scheme === 'http' || scheme === 'https') {
    return openExternal(url);
  }
  // System-handled schemes (tel/mailto/sms/geo) — open in the OS handler.
  try {
    // On iOS, window.open with these schemes works inside the WebView because
    // WKWebView forwards them to the system. On Android, Capacitor's App plugin
    // can launch the right intent via App.openUrl({ url }).
    if (isAndroid()) {
      const { App } = await import('@capacitor/app');
      // @capacitor/app v6 doesn't expose openUrl; fall back to window.open.
      // (Future-proof: the method may be added in a later release.)
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

// ── Keyboard dismissal (iOS "done" key workaround) ──────────────────────────

export function dismissKeyboard(): void {
  if (typeof document === 'undefined') return;
  const el = document.activeElement as HTMLElement | null;
  if (el && typeof el.blur === 'function') el.blur();
}

// ── Status bar runtime theme switch ──────────────────────────────────────────

export async function setStatusBarTheme(dark: boolean): Promise<void> {
  if (!isCapacitor()) return;
  try {
    if (platform() === 'android') {
      // Android runs edge-to-edge via the SafeArea plugin, which owns the
      // system-bar colors there — StatusBar.setBackgroundColor gets ignored
      // (that's how the bar ended up black on the light theme). Transparent
      // bars let the app's own background show through; only the icon
      // contrast flips with the theme.
      const { SafeArea } = await import('@capacitor-community/safe-area');
      await SafeArea.enable({
        config: {
          customColorsForSystemBars: true,
          // Solid theme colors — the alpha plugin ignores transparent values.
          statusBarColor: dark ? '#0a0a0a' : '#f4f4f6',
          statusBarContent: dark ? 'light' : 'dark',
          navigationBarColor: dark ? '#0a0a0a' : '#f4f4f6',
          navigationBarContent: dark ? 'light' : 'dark',
        },
      });
    } else {
      const SB = await import('@capacitor/status-bar');
      const { StatusBar, Style } = SB;
      await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
      await StatusBar.setBackgroundColor({ color: dark ? '#0a0a0a' : '#f4f4f6' });
    }
  } catch { /* noop */ }
}

// ── Connect / disconnect a global "tap-to-dismiss-keyboard" listener ────────
// Returns an unsubscribe function. Tap-anywhere-on-empty-space dismisses.

export function attachKeyboardDismisser(): () => void {
  if (typeof document === 'undefined') return () => {};
  const onTouch = (e: TouchEvent) => {
    const t = e.target as HTMLElement | null;
    // Only dismiss when the tap isn't on a form field — otherwise we'd
    // blur the field the user just focused.
    if (!t) return;
    const tag = t.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return;
    dismissKeyboard();
  };
  document.addEventListener('touchstart', onTouch, { passive: true });
  return () => document.removeEventListener('touchstart', onTouch);
}

// ── Geolocation (for "find a doctor near me") ───────────────────────────────

export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (!isCapacitor()) {
    if (!navigator.geolocation) return null;
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
      );
    });
  }
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch { return null; }
}

// ── Toast (native) ──────────────────────────────────────────────────────────

export async function nativeToast(message: string, duration: 'short' | 'long' = 'short'): Promise<void> {
  if (!isCapacitor()) return;
  try {
    const { Toast } = await import('@capacitor/toast');
    await Toast.show({ text: message, duration: duration === 'long' ? 'long' : 'short' });
  } catch { /* noop */ }
}

// ── Convenience: ensure the FeelFit backend URL is reachable from the app ────

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'https://api.feelfit.app';
}

// ── Capacitor-only mount hook: invoke once at app start ─────────────────────

export async function bootstrapNative(): Promise<void> {
  if (!isCapacitor()) return;
  // Hide splash as soon as React has painted.
  await hideSplash();
  // Enable edge-to-edge + safe-area CSS vars AND set the system bars to the
  // app's default LIGHT theme in one call (on Android the SafeArea plugin
  // owns system-bar colors — see setStatusBarTheme). Forcing dark here used
  // to leave a black status bar on the light UI.
  await setStatusBarTheme(false);
}

// Re-export commonly used types
export type { AnalysisProfile };
