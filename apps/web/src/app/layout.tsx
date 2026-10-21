import { resolveSemanticColors } from '@kawan-pasar/tokens';
import { Inter, JetBrains_Mono } from 'next/font/google';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@/styles/globals.css';

// Self-hosted at build time by next/font, so CSP `font-src 'self'` holds.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Kawan Pasar', template: '%s · Kawan Pasar' },
  description: 'Hitung modal menu dan pantau risiko harga bahan pangan untuk warung.',
};

export const viewport: Viewport = {
  themeColor: [
    {
      media: '(prefers-color-scheme: light)',
      color: resolveSemanticColors('light').get('bg.brand') ?? '',
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: resolveSemanticColors('dark').get('bg.canvas') ?? '',
    },
  ],
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
