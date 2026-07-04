/** @type {import('next').NextConfig} */
// ─────────────────────────────────────────────────────────────────────────────
// FeelFit — Mobile (Capacitor) Next.js config
// The mobile app is shipped as a STATIC EXPORT (out/). Capacitor loads these
// static assets from the device; there is no Node.js server inside the app.
// All dynamic data still flows through the FastAPI backend (NEXT_PUBLIC_API_URL).
// ─────────────────────────────────────────────────────────────────────────────
const isMobile = process.env.BUILD_TARGET === 'mobile' || process.env.CAPACITOR === '1';

const config = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Static export — required for Capacitor to bundle the app into the WebView.
  // The web (Vercel/Docker) build still works because the app is a SPA that
  // only uses the file-system root and the client-side API layer.
  output: isMobile ? 'export' : 'standalone',

  // Mobile builds get their own build dir. Sharing .next with `next dev`
  // corrupts the dev server's chunk manifest whenever a mobile export runs
  // alongside it (symptom: ChunkLoadError on lazy tabs like AskFit).
  distDir: isMobile ? '.next-mobile' : '.next',

  // Capacitor WebView can't optimize images via the Next.js server, so we ship
  // them as-is. (Unoptimized images also render fine on the web build.)
  images: { unoptimized: true },

  // Trailing slash = clean file-per-route output (each route → /route/index.html).
  trailingSlash: true,

  env: {
    // Default to the local backend for first-run dev convenience.
    // For production mobile/web builds, set NEXT_PUBLIC_API_URL in CI/Vercel.
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
    // Flag the Capacitor build to the client so lib/native.ts can auto-detect.
    NEXT_PUBLIC_CAPACITOR: isMobile ? '1' : '',
  },

  async headers() {
    if (isMobile) return []; // No headers in static-export mode
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), microphone=(), camera=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
};

module.exports = config;
