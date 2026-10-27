import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { cn } from '../cn.js';
import { Callout } from './callout.js';
import { Card } from './card.js';
import { DataStatus } from './data-status.js';
import { DemoBadge } from './demo-badge.js';
import { MetricCard } from './metric-card.js';
import { MovementBadge, directionOf } from './movement-badge.js';
import { EmptyState, ErrorState, Skeleton } from './states.js';

describe('directionOf', () => {
  it.each([
    [0.032, 'up'],
    [-0.011, 'down'],
    [0, 'flat'],
    // Shown as 0,0%: never drawn as a rise or a fall.
    [0.0004, 'flat'],
    [-0.0004, 'flat'],
  ])('%d is %s', (change, expected) => {
    expect(directionOf(change)).toBe(expected);
  });
});

describe('MovementBadge', () => {
  it('carries direction in words and symbols, not only colour', () => {
    render(<MovementBadge change={0.032} label="+3,2%" />);
    expect(screen.getByText('naik', { exact: false })).toBeDefined();
    expect(screen.getByText('↑')).toBeDefined();
    expect(screen.getByText('+3,2%')).toBeDefined();
  });
});

describe('MetricCard', () => {
  it('shows the value and caption', () => {
    render(<MetricCard label="Modal per porsi" value="Rp 10.850" caption="Hari ini" />);
    expect(screen.getByText('Rp 10.850')).toBeDefined();
    expect(screen.getByText('Hari ini')).toBeDefined();
  });

  it('never shows 0 for a missing value', () => {
    render(<MetricCard label="Margin" value={null} emptyLabel="Belum bisa dihitung" />);
    expect(screen.getByText('Belum bisa dihitung')).toBeDefined();
    expect(screen.queryByText(/Rp 0/)).toBeNull();
  });

  it('renders names in the text style', () => {
    render(
      <MetricCard label="Bahan paling berisiko" value="Cabai merah keriting" valueKind="text" />,
    );
    expect(screen.getByText('Cabai merah keriting').className).not.toContain('tabular-nums');
  });

  it('renders the brand tone and a badge', () => {
    render(<MetricCard label="Perkiraan" value="Rp 10.914" tone="brand" badge={<DemoBadge />} />);
    expect(screen.getByText('Rp 10.914').className).toContain('text-text-brand');
    expect(screen.getByText('DATA DEMO')).toBeDefined();
  });
});

describe('Callout', () => {
  it('announces errors as alerts and other tones as notes', () => {
    render(
      <>
        <Callout tone="error" title="Gagal memuat" />
        <Callout tone="info" title="Modal parsial">
          Dihitung dari 3 dari 5 bahan.
        </Callout>
      </>,
    );
    expect(screen.getByRole('alert').textContent).toContain('Gagal memuat');
    expect(screen.getByRole('note').textContent).toContain('3 dari 5 bahan');
  });
});

describe('DataStatus', () => {
  it('uses the glossary words (docs 09 §7.1)', () => {
    render(<DataStatus state="coming_soon" />);
    expect(screen.getByText('Harga sedang disiapkan')).toBeDefined();
  });

  it('accepts a more specific label', () => {
    render(<DataStatus state="stale" label="Data s.d. 11 Okt 2026" />);
    expect(screen.getByText('Data s.d. 11 Okt 2026')).toBeDefined();
  });
});

describe('states', () => {
  it('ErrorState shows the request id, not a stack', () => {
    render(<ErrorState title="Harga tidak dapat dimuat" requestId="req_abc" />);
    expect(screen.getByRole('alert').textContent).toContain('req_abc');
  });

  it('EmptyState renders its action', () => {
    render(
      <EmptyState
        title="Belum ada menu"
        description="Tambahkan menu untuk melihat modal per porsi."
        action={<button type="button">Tambah menu</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Tambah menu' })).toBeDefined();
  });

  it('EmptyState places an illustration above the title', () => {
    render(<EmptyState title="Segera hadir" illustration={<svg data-testid="maskot" />} />);
    const picture = screen.getByTestId('maskot');
    const title = screen.getByText('Segera hadir');
    expect(picture.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Skeleton and Card render', () => {
    const { container } = render(
      <Card aria-label="ringkasan">
        <Skeleton className="h-4" />
      </Card>,
    );
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('cn', () => {
  it('lets the later utility win', () => {
    expect(cn('p-4', false, 'p-2')).toBe('p-2');
  });
});

describe('optional parts', () => {
  it('renders states without description, request id, or action', () => {
    render(
      <>
        <EmptyState title="Kosong" />
        <ErrorState title="Gagal" />
      </>,
    );
    expect(screen.getByText('Kosong')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe('Gagal');
  });
});
