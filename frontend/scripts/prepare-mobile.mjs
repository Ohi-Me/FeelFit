// ════════════════════════════════════════════════════════════════════════════
// scripts/prepare-mobile.mjs
// ════════════════════════════════════════════════════════════════════════════
// Post-build hook that prepares Next.js's static export (out/) for use inside
// Capacitor. Runs automatically after `npm install` (postinstall) and before
// every `cap sync`. Safe to run multiple times — it patches only what's missing.
//
// What it does:
//   1. Creates convenience symlinks frontend/android → ../android and
//      frontend/ios → ../ios so Capacitor can find the native projects next
//      to capacitor.config.ts (Capacitor's expected layout). The actual
//      projects live at the repo root.
//   2. Injects `<base href="./">` into every index.html so relative asset
//      URLs resolve correctly when the WebView loads via capacitor:// or
//      https://localhost
//   3. Pre-wraps the body with `is-capacitor` class hint for SSR consistency
//   4. Adds the apple-touch-icon link to PWA-style metadata
//   5. Verifies capacitor.config.ts exists; if not, warns (doesn't fail)
// ════════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, symlinkSync, lstatSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CFG = join(ROOT, 'capacitor.config.ts');

// ── Step 1: ensure native-project symlinks exist ───────────────────────────
// Capacitor expects android/ and ios/ next to capacitor.config.ts. In this
// monorepo layout the real native projects live at the repo root, so we
// create symlinks here. Idempotent — safe to run on every install.
//
// Cross-platform note: when this repo is zipped and extracted on Windows,
// symlinks become tiny text files containing the target path. We detect that
// case (file size ≤ 64 bytes) and replace them with real symlinks. On
// macOS/Linux, symlinks survive zip→unzip so this is a no-op.
for (const [name, target] of [['android', '../android'], ['ios', '../ios']]) {
  const linkPath = join(ROOT, name);
  const realTarget = join(ROOT, target);
  const targetExists = existsSync(realTarget);
  let needCreate = false;

  try {
    const st = lstatSync(linkPath);
    if (st.isSymbolicLink()) {
      // Already a symlink — leave it alone.
      continue;
    }
    if (st.isDirectory()) {
      // Real directory (e.g. user manually placed android/ inside frontend/).
      // Don't touch it.
      console.log(`[prepare-mobile] ${name}/ already exists as a directory. Leaving as-is.`);
      continue;
    }
    if (st.isFile() && st.size <= 64) {
      // Likely a Windows-extracted symlink text file (contains the target path).
      // Remove it so we can recreate as a real symlink.
      try {
        unlinkSync(linkPath);
        needCreate = true;
      } catch {
        console.warn(`[prepare-mobile] ${name}/ exists as a small file but couldn't be removed. Leaving as-is.`);
      }
    } else {
      console.log(`[prepare-mobile] ${name}/ already exists as a file. Leaving as-is.`);
    }
  } catch {
    // Doesn't exist — create the symlink only if the real native project exists.
    needCreate = true;
  }

  if (needCreate && targetExists) {
    try {
      symlinkSync(target, linkPath, 'dir');
      console.log(`[prepare-mobile] Created symlink: frontend/${name} → ${target}`);
    } catch (e) {
      console.warn(`[prepare-mobile] Could not create ${name} symlink: ${e.message}`);
      console.warn(`[prepare-mobile] On Windows, run as Administrator or enable Developer Mode.`);
    }
  }
}

// ── Step 1b: ensure root-level node_modules symlink exists ─────────────────
// The native projects (android/, ios/) reference `../node_modules/...` and
// `../../node_modules/...` from their respective build files (Gradle's
// capacitor.settings.gradle and CocoaPods' Podfile). These paths resolve to
// the REPO ROOT, not frontend/. We create a root-level node_modules symlink
// → frontend/node_modules so those paths work without duplicating the
// 700+ MB of installed packages.
const REPO_ROOT = join(ROOT, '..');
const ROOT_NM_LINK = join(REPO_ROOT, 'node_modules');
const ROOT_NM_REAL = join(ROOT, 'node_modules');
let needRootNm = false;
try {
  const st = lstatSync(ROOT_NM_LINK);
  if (st.isSymbolicLink()) {
    // Already a symlink — leave it alone.
  } else if (st.isDirectory()) {
    // Real directory — could be a separate install. Don't touch it.
  } else if (st.isFile() && st.size <= 64) {
    // Windows-extracted symlink text file — replace.
    try { unlinkSync(ROOT_NM_LINK); needRootNm = true; } catch {}
  }
} catch {
  needRootNm = true;
}
if (needRootNm && existsSync(ROOT_NM_REAL)) {
  try {
    symlinkSync('frontend/node_modules', ROOT_NM_LINK, 'dir');
    console.log('[prepare-mobile] Created symlink: ./node_modules → frontend/node_modules');
  } catch (e) {
    console.warn(`[prepare-mobile] Could not create root node_modules symlink: ${e.message}`);
  }
}

const OUT = join(ROOT, 'out');
if (!existsSync(OUT)) {
  console.log('[prepare-mobile] No out/ directory yet (run `npm run build` first). Skipping HTML patching.');
  process.exit(0);
}
if (!existsSync(CFG)) {
  console.warn('[prepare-mobile] WARNING: capacitor.config.ts not found. Run `npx cap init` first.');
}

let htmlCount = 0;
function patchHtml(filePath) {
  let html = readFileSync(filePath, 'utf8');
  if (html.includes('data-ff-prepared="1"')) return;
  // Inject <base href="./"> right after <head> so all asset URLs resolve
  // relative to the current document — required for Capacitor's capacitor:// scheme.
  html = html.replace(/<head([^>]*)>/i, '<head$1 data-ff-prepared="1">\n  <base href="./">');
  // Pre-add the is-capacitor class to <html> so first paint already has mobile CSS applied
  html = html.replace(/<html([^>]*)>/i, (m, attrs) => {
    if (attrs.includes('class=')) {
      return m.replace(/class="([^"]*)"/, (_, cls) => `class="${cls} is-capacitor"`);
    }
    return m.replace('<html', `<html class="is-capacitor"`);
  });
  writeFileSync(filePath, html, 'utf8');
  htmlCount++;
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p);
    else if (entry.endsWith('.html')) patchHtml(p);
  }
}

walk(OUT);
console.log(`[prepare-mobile] Patched ${htmlCount} HTML file(s) in out/`);

// Make sure the icons folder exists with at least a placeholder apple-touch-icon
const iconsDir = join(ROOT, 'public', 'icons');
if (!existsSync(iconsDir)) {
  console.log('[prepare-mobile] Tip: add public/icons/apple-touch-icon.png (180×180) for iOS home-screen icon.');
}
