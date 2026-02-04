export const metadata = {
  title: 'FeelFit - Advanced Medical Report Analyzer',
  description: 'AI-powered medical report analysis with NLP and computer vision. Get comprehensive diagnostics, personalized recommendations, and specialist suggestions.',
  keywords: 'medical analysis, AI healthcare, report analyzer, doctor finder, medical diagnostics, FeelFit',
  authors: [{ name: 'FeelFit Team' }],
  viewport: 'width=device-width, initial-scale=1, maximum-scale=5',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  openGraph: {
    title: 'FeelFit - Medical Intelligence',
    description: 'Advanced AI-powered medical report analysis',
    type: 'website',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body style={{ margin: 0, padding: 0, overflow: 'auto', position: 'relative' }}>
        {children}
      </body>
    </html>
  );
}
