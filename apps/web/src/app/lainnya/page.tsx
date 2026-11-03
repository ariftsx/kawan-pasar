import Link from 'next/link';

import { FeatureIcon } from '@/components/brand/feature-icon';
import { FOCUS } from '@/components/kp/blocks';
import { SECONDARY_NAV } from '@/components/shell/nav-items';

import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Lainnya' };

/** Secondary navigation for mobile. */
export default function LainnyaPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-extrabold">Lainnya</h1>
      <ul className="flex flex-col divide-y divide-border-default rounded-3xl border border-border-default bg-bg-surface">
        {SECONDARY_NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`flex min-h-16 items-center gap-4 rounded-3xl px-5 py-3 ${FOCUS}`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-bg-subtle">
                <FeatureIcon name={item.icon} />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-lg font-semibold">{item.label}</span>
                <span className="text-base text-text-secondary">{item.note}</span>
              </span>
              <span aria-hidden className="text-text-muted">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
