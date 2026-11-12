import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { SiteShell } from '@/components/templates/SiteShell';
import { geistMono, jakarta } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Kawan Pasar', template: '%s · Kawan Pasar' },
  description:
    'Pantau harga pangan harian di Pasar Kramat Jati dan perkiraannya, supaya belanja lebih tenang.',
  applicationName: 'Kawan Pasar',
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#0E4D35',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="id" className={`${jakarta.variable} ${geistMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
