import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import '@/styles/mobile.css';

export const metadata: Metadata = {
  title: 'FeelFit — AI Medical Report Intelligence',
  description: 'Upload lab reports for AI health insights using LOINC + OCR + NLP + LLM pipeline. Safe, non-diagnostic, schema-validated.',
  keywords: 'medical report analyzer, LOINC, AI health insights, lab report, blood test analyzer, India, Ludhiana',
  authors: [{ name: 'FeelFit' }],
  icons: {
    icon: '/favicon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: 'FeelFit — AI Medical Report Intelligence',
    description: 'Understand your lab reports with AI-powered health insights.',
    type: 'website',
  },
  appleWebApp: {
    capable: true,
    title: 'FeelFit',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0a0a',
  viewportFit: 'cover', // ← critical for iOS safe-area-inset-* env() to work
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve the API host at build time so we can emit preconnect / dns-prefetch
  // hints — this shaves ~100-300 ms off the first /api/usage call on cold launch.
  const apiHost = process.env.NEXT_PUBLIC_API_URL || 'https://api.feelfit.app';
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Della+Respira&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        {/* API host hints — early TCP/TLS handshake so the first /api/usage
            call doesn't pay the full connection cost. */}
        <link rel="preconnect" href={apiHost} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href={apiHost} />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        {children}
      </body>
    </html>
  );
}
