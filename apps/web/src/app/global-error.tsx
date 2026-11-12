'use client';

import type { ReactNode } from 'react';
import './globals.css';

/** Last-resort boundary (root layout failed). Kept minimal: no shell, no data. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }): ReactNode {
  return (
    <html lang="id">
      <body className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-ink">
        <main className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-heading-title-20">Kawan Pasar sedang mengalami gangguan</h1>
          <p className="text-body-medium-15 text-ink-2">Coba muat ulang halaman sebentar lagi.</p>
          <button
            type="button"
            onClick={() => {
              reset();
            }}
            className="min-h-11 rounded-full bg-green-900 px-5 font-bold text-surface"
          >
            Coba lagi
          </button>
        </main>
      </body>
    </html>
  );
}
