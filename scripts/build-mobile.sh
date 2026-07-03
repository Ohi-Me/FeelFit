#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# scripts/build-mobile.sh — build the Capacitor (Android + iOS) app
# ════════════════════════════════════════════════════════════════════════════
# Produces:
#   frontend/out/         Next.js static export
#   android/app/build/    Android APK / AAB (via gradle)
#   ios/App/build/        iOS Xcode project (build with Xcode on macOS)
#
# Usage:
#   scripts/build-mobile.sh android   # build APK
#   scripts/build-mobile.sh ios       # prepare Xcode project (build on macOS)
#   scripts/build-mobile.sh sync      # just `cap sync` without native build
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-sync}"
cd frontend

echo "[build-mobile] Installing dependencies..."
npm install --legacy-peer-deps

echo "[build-mobile] Running static export (BUILD_TARGET=mobile)..."
BUILD_TARGET=mobile NEXT_PUBLIC_CAPACITOR=1 npm run build

echo "[build-mobile] Patching out/ for Capacitor WebView..."
node scripts/prepare-mobile.mjs

echo "[build-mobile] Running capacitor sync..."
npx cap sync

case "$TARGET" in
  android)
    echo "[build-mobile] Building Android APK..."
    cd ../android
    ./gradlew assembleDebug
    echo "[build-mobile] APK: android/app/build/outputs/apk/debug/app-debug.apk"
    ;;
  ios)
    if [ "$(uname)" != "Darwin" ]; then
      echo "[build-mobile] iOS builds require macOS + Xcode. Opening project only."
      npx cap open ios
    else
      echo "[build-mobile] Opening Xcode — press Run to build."
      npx cap open ios
    fi
    ;;
  sync)
    echo "[build-mobile] Sync complete. Run 'npx cap open android' or 'npx cap open ios' to build."
    ;;
  *)
    echo "Usage: $0 {android|ios|sync}"
    exit 1
    ;;
esac
