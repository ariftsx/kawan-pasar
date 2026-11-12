import { readFileSync } from 'node:fs';
import path from 'node:path';
import { COMMODITIES } from '@kawan-pasar/catalog';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CommodityIcon } from './CommodityIcon';
import { FEATURE_ICON_NAMES } from './data/feature-icons';
import { ILLUSTRATION_NAMES } from './data/illustrations-data';
import { FeatureIcon } from './FeatureIcon';
import { Illustration } from './Illustration';
import { Kapa } from './Kapa';
import { KAPA_POSES } from './kapa-poses';
import { Logo } from './Logo';

describe('Kapa', () => {
  it.each(KAPA_POSES)('renders pose %s with its prop', (pose) => {
    const { container } = render(<Kapa pose={pose} size={120} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('data-pose')).toBe(pose);
    expect(svg?.getAttribute('width')).toBe('120');
    const prop = container.querySelector('[data-kapa-prop]')?.getAttribute('data-kapa-prop');
    const expected = {
      prediksi: 'chart',
      istirahat: 'zzz',
      waspada: 'alert',
      belajar: 'mag',
      senang: 'spark',
    } as const;
    expect(prop ?? 'none').toBe(
      pose in expected ? expected[pose as keyof typeof expected] : 'none',
    );
  });

  it('is decorative by default', () => {
    const { container } = render(<Kapa pose="halo" size={96} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('becomes an image with an accessible name when it carries meaning', () => {
    render(<Kapa pose="waspada" size={96} label="Kapa waspada: data gagal dimuat" />);
    expect(screen.getByRole('img', { name: 'Kapa waspada: data gagal dimuat' })).toBeTruthy();
  });

  it('keeps the size within the v0.4 range', () => {
    const { container } = render(<Kapa pose="halo" size={400} />);
    expect(container.querySelector('svg')?.getAttribute('width')).toBe('200');
  });
});

describe('kapa.css', () => {
  const css = readFileSync(path.join(process.cwd(), 'src/brand/kapa.css'), 'utf8');

  it('only animates while playing and never under reduced motion', () => {
    expect(css).toMatch(/\[data-playing\]/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none/);
  });

  it('never moves for more than 5 seconds at a time (WCAG 2.2.2)', () => {
    const decls = [...css.matchAll(/animation:\s*([^;]+);/g)].map((m) => m[1] ?? '');
    const running = decls.filter((d) => d.trim() !== 'none !important');
    expect(running.length).toBeGreaterThan(0);
    for (const d of running) {
      expect(d).not.toContain('infinite');
      const ms = Number(/(\d+)ms/.exec(d)?.[1]);
      const count = Number(/\s(\d+)\s*$/.exec(d)?.[1] ?? '1');
      expect(ms * count).toBeLessThanOrEqual(5000);
    }
  });

  it('animates transform and opacity only', () => {
    const keyframes = css.match(/@keyframes[\s\S]*?\n\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThan(0);
    for (const k of keyframes) {
      const props = [...k.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      expect(props.every((p) => p === 'transform' || p === 'opacity')).toBe(true);
    }
  });
});

describe('Logo and icons', () => {
  it('names the logo for assistive technology', () => {
    render(<Logo variant="horizontal" />);
    expect(screen.getByRole('img', { name: 'Kawan Pasar' })).toBeTruthy();
  });

  it.each(COMMODITIES.map((c) => c.code))('has an icon for commodity %s', (code) => {
    const { container } = render(<CommodityIcon code={code} size={40} />);
    expect(container.querySelector('svg path, svg ellipse')).not.toBeNull();
  });

  it.each(FEATURE_ICON_NAMES)('has feature icon %s', (name) => {
    const { container } = render(<FeatureIcon name={name} />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it.each(ILLUSTRATION_NAMES)('has illustration %s', (name) => {
    const { container } = render(<Illustration name={name} />);
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
  });
});
