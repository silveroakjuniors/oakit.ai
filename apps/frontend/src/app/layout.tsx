import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: 'Oakit.ai — Built for SilverOak Juniors',
  description: 'AI-powered curriculum management for modern preschools',
  manifest: '/manifest.json',
  themeColor: '#1A3C2E',
  viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider>
          <BrandColorInit />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
