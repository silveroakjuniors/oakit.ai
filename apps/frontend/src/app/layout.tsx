import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import BrandColorInit from '@/components/BrandColorInit';
import { ThemeProvider } from '@/contexts/ThemeContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1a3c2e',
};

export const metadata: Metadata = {
  title: 'Oakit.ai — School Intelligence',
  description: 'AI-powered school management for teachers, parents and principals',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Oakit',
    startupImage: '/oakie.png',
  },
  icons: {
    icon: '/oakie.png',
    apple: '/oakie.png',
    shortcut: '/oakie.png',
  },
  other: {
    // iOS full-screen PWA
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Oakit',
    // Windows tile
    'msapplication-TileColor': '#1a3c2e',
    'msapplication-TileImage': '/oakie.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* iOS splash / icon — explicit tags for maximum compatibility */}
        <link rel="apple-touch-icon" href="/oakie.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/oakie.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/oakie.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/oakie.png" />
        <link rel="icon" type="image/png" href="/oakie.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Oakit" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="Oakit" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <BrandColorInit />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
