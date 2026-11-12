import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ARTICLES, summaryFixture } from '../../../../test/fixtures';

const api = vi.hoisted(() => ({ articles: vi.fn(), article: vi.fn(), priceSummary: vi.fn() }));
vi.mock('@/lib/api/endpoints', () => ({ api }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/edukasi',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const { default: Edukasi } = await import('./page');
const { default: Artikel } = await import('./[slug]/page');

const BODY =
  '## Inflasi, singkatnya\n\nTeks.\n\n## Cara memakai prediksi untuk anggaran\n\n1. satu';

beforeEach(() => {
  api.articles.mockResolvedValue({ ok: true, data: { items: ARTICLES } });
  api.priceSummary.mockResolvedValue({ ok: true, data: summaryFixture() });
  api.article.mockResolvedValue({
    ok: true,
    data: { ...ARTICLES[0], bodyMd: BODY, updatedAt: '2026-11-12T00:00:00.000Z' },
  });
});

describe('Edukasi', () => {
  it('lists the published articles and announces the rest without titles', async () => {
    render(await Edukasi({ params: Promise.resolve({ market: 'PIKJ' }) }));
    expect(screen.getAllByRole('link', { name: /Apa itu inflasi pangan/ }).length).toBeGreaterThan(
      0,
    );
    expect(document.body.textContent).toContain('Topik lain sedang ditinjau');
  });
});

describe('Artikel', () => {
  const page = (slug: string) => Artikel({ params: Promise.resolve({ market: 'PIKJ', slug }) });

  it('renders the body with a table of contents and real price examples', async () => {
    render(await page('apa-itu-inflasi-pangan'));
    expect(screen.getByRole('heading', { level: 1, name: /Apa itu inflasi pangan/ })).toBeTruthy();
    const toc = screen.getByRole('navigation', { name: 'Di halaman ini' });
    expect(toc.querySelector('a[href="#cara-memakai-prediksi-untuk-anggaran"]')).not.toBeNull();
    expect(document.getElementById('cara-memakai-prediksi-untuk-anggaran')).not.toBeNull();
    expect(document.body.textContent).toContain('Rp 63.150');
  });

  it('answers an unknown slug with 404 without asking the API for it', async () => {
    await expect(page('tidak-ada')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(api.article).not.toHaveBeenCalled();
  });
});
