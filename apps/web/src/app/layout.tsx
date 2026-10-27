import { resolveSemanticColors } from '@kawan-pasar/tokens';
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from 'next/font/google';
import { connection } from 'next/server';

import { BottomTabBar } from '@/components/shell/bottom-tab-bar';
import { DemoBanner } from '@/components/shell/demo-banner';
import { Providers } from '@/components/shell/providers';
import { SiteFooter } from '@/components/shell/site-footer';
import { SiteHeader } from '@/components/shell/site-header';
import { publicEnv } from '@/lib/env';

import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@/styles/globals.css';

// Self-hosted at build time by next/font, so CSP `font-src 'self'` holds.
const atkinson = Atkinson_Hyperlegible_Next({
  subsets: ['latin'],
  variable: '--font-atkinson',
  display: 'swap',
});
const atkinsonMono = Atkinson_Hyperlegible_Mono({
  subsets: ['latin'],
  variable: '--font-atkinson-mono',
  display: 'swap',
});

// Nonce-based CSP needs per-request HTML: a prerendered shell would carry no nonce and the
// browser would block every script (docs 12 §9). `instant = false` + `connection()` make every
// route blocking-dynamic; data can still use 'use cache'. Edge-cached HTML stays OPEN CSP-01.
export const instant = false;

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

export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  await connection();
  const isDemo = publicEnv.NEXT_PUBLIC_DATA_MODE === 'demo';
  return (
    <html lang="id" className={`${atkinson.variable} ${atkinsonMono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <a
            href="#konten"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-overlay focus:rounded-md focus:bg-bg-surface focus:p-2"
          >
            Lewati ke konten
          </a>
          <SiteHeader />
          {isDemo ? <DemoBanner /> : null}
          <main id="konten" className="mx-auto w-full max-w-content flex-1 px-4 py-6 lg:px-12">
            {children}
          </main>
          <SiteFooter isDemo={isDemo} />
          <BottomTabBar />
        </Providers>
      </body>
    </html>
  );
}
