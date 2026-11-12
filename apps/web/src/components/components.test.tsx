import type { CommoditySummary } from '@kawan-pasar/contracts';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './atoms/Button';
import { Delta } from './atoms/Delta';
import { HorizonPill } from './atoms/HorizonPill';
import { PredictionBadge } from './atoms/PredictionBadge';
import { Sparkline } from './atoms/Sparkline';
import { CommodityCard } from './molecules/CommodityCard';
import { CommodityRow } from './molecules/CommodityRow';
import { NavLinks } from './organisms/NavLinks';
import { SystemState } from './organisms/SystemState';
import { SiteShell } from './templates/SiteShell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/harga',
  useRouter: () => ({ refresh: vi.fn() }),
}));

const base: CommoditySummary = {
  code: 'cabai-merah-keriting',
  name: 'Cabai merah keriting',
  unit: 'kg',
  modelCoverage: 'covered',
  dataStatus: 'fresh',
  latest: { observedOn: '2026-09-30', priceIdr: 52_400 },
  change7d: 0.032,
  change30d: 0.1,
  sparkline: [
    { observedOn: '2026-09-28', priceIdr: 50_000 },
    { observedOn: '2026-09-29', priceIdr: 51_000 },
    { observedOn: '2026-09-30', priceIdr: 52_400 },
  ],
  forecast7d: { status: 'available', q50Change: 0.028, direction: 'up' },
};

const noData: CommoditySummary = {
  ...base,
  code: 'cabai-rawit-hijau',
  name: 'Cabai rawit hijau',
  modelCoverage: 'pending',
  dataStatus: 'no_data',
  latest: null,
  change7d: null,
  change30d: null,
  sparkline: [],
  forecast7d: { status: 'pending_coverage', q50Change: null, direction: null },
};

describe('Delta', () => {
  it('shows arrow, sign and value, and names the direction in words', () => {
    const { container } = render(<Delta value={0.032} />);
    expect(container.textContent).toBe('naik ↑ +3,2%');
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('↑');
  });

  it('shows unknown as an em dash', () => {
    const { container } = render(<Delta value={null} />);
    expect(container.textContent).toContain('—');
    expect(container.textContent).not.toContain('0,0');
  });

  it('calls a change that rounds to zero stable', () => {
    const { container } = render(<Delta value={0.0001} />);
    expect(container.textContent).toBe('stabil 0,0%');
  });
});

describe('PredictionBadge', () => {
  it.each([
    ['expired', 'Kedaluwarsa'],
    ['pending_coverage', 'Prediksi menyusul'],
    ['hidden', 'Belum tersedia'],
    ['unavailable', 'Belum tersedia'],
  ] as const)('labels status %s', (status, label) => {
    render(<PredictionBadge status={status} q50Change={0.01} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('shows the median change for available forecasts and a demo label when asked', () => {
    const { container } = render(<PredictionBadge status="available" q50Change={0.028} isDemo />);
    expect(container.textContent).toContain('+2,8%');
    expect(container.textContent).toContain('Data demo');
  });
});

describe('Sparkline', () => {
  it('says when there is not enough data instead of drawing a fake line', () => {
    render(<Sparkline points={[]} direction={null} />);
    expect(screen.getByText('Data belum cukup')).toBeTruthy();
  });
});

describe('CommodityCard', () => {
  it('renders price, change and forecast', () => {
    render(<CommodityCard item={base} href="/harga" />);
    const card = screen.getByRole('article');
    expect(within(card).getByText('Rp 52.400')).toBeTruthy();
    expect(card.textContent).toContain('+3,2%');
    expect(card.textContent).toContain('+2,8%');
    expect(within(card).getByRole('link', { name: 'Cabai merah keriting' })).toBeTruthy();
  });

  it('never shows Rp 0 for a commodity without data', () => {
    render(<CommodityCard item={noData} href="/harga" />);
    const card = screen.getByRole('article');
    expect(card.textContent).toContain('—');
    expect(card.textContent).toContain('Data belum tersedia');
    expect(card.textContent).not.toMatch(/Rp\s?0\b/);
    expect(card.textContent).toContain('Prediksi menyusul');
  });

  it('marks stale prices', () => {
    render(<CommodityCard item={{ ...base, dataStatus: 'stale' }} href="/harga" />);
    expect(screen.getByText('Terlambat')).toBeTruthy();
  });
});

describe('CommodityRow', () => {
  it('shows the same unknown rules on mobile', () => {
    render(<CommodityRow item={noData} href="/harga" />);
    expect(screen.getByRole('link').textContent).toContain('—');
  });
});

describe('Button', () => {
  it('renders a link when given href and keeps a 44 px target', () => {
    render(
      <Button href="/harga" size="S">
        Lihat harga
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Lihat harga' });
    expect(link.className).toContain('min-h-11');
  });

  it('renders a button otherwise', () => {
    render(<Button type="button">Coba lagi</Button>);
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeTruthy();
  });
});

describe('NavLinks', () => {
  it('marks the current section', () => {
    render(<NavLinks variant="desktop" />);
    expect(screen.getByRole('link', { name: 'Harga' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Beranda' }).getAttribute('aria-current')).toBeNull();
  });
});

describe('SystemState', () => {
  it('offers a retry for load failures', () => {
    render(<SystemState kind="load_failed" />);
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeTruthy();
  });

  it('shows the last data date for stale prices', () => {
    render(<SystemState kind="price_stale" lastObservedOn="2026-09-30" />);
    expect(screen.getByText(/Rabu, 30 September 2026/)).toBeTruthy();
  });
});

describe('SiteShell', () => {
  it('has a skip link to the main content', () => {
    render(
      <SiteShell>
        <p>isi</p>
      </SiteShell>,
    );
    const skip = screen.getByRole('link', { name: 'Lewati ke konten' });
    expect(skip.getAttribute('href')).toBe('#konten');
    expect(document.querySelector('main#konten')).not.toBeNull();
  });
});

describe('HorizonPill', () => {
  it('keeps the visible label inside its accessible name (voice control, WCAG 2.5.3)', () => {
    render(<HorizonPill label="7H" longLabel="7 hari" active />);
    const button = screen.getByRole('button', { name: /7H/ });
    expect(button.getAttribute('aria-label')).toBeNull();
    expect(button.textContent).toContain('7 hari');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });
});
