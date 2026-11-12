import localFont from 'next/font/local';

export const jakarta = localFont({
  src: '../brand/fonts/PlusJakartaSans-latin.woff2',
  variable: '--font-jakarta',
  weight: '200 800',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
});

export const geistMono = localFont({
  src: '../brand/fonts/GeistMono-latin.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'monospace'],
});
