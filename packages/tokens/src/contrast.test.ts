import { describe, expect, it } from 'vitest';

import { auditContrast, contrastRatio, relativeLuminance } from './contrast.js';
import { createColorResolver, resolveSemanticColors } from './resolve.js';

function ratioOf(theme: 'light' | 'dark', fg: string, bg: string): number {
  const colors = resolveSemanticColors(theme);
  return contrastRatio(colors.get(fg) ?? '', colors.get(bg) ?? '');
}

describe('WCAG contrast maths', () => {
  it('matches the reference extremes', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
    expect(relativeLuminance('#000000')).toBe(0);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 10);
  });

  it('rejects anything but #rrggbb', () => {
    expect(() => relativeLuminance('#fff')).toThrow('Expected #rrggbb');
  });
});

describe('token contrast gate (CI)', () => {
  it.each(
    auditContrast().map((result) => [`${result.theme} ${result.fg} on ${result.bg}`, result]),
  )('%s', (_, result) => {
    expect(result.ratio).toBeGreaterThanOrEqual(result.min);
  });

  it('reproduces the documented audit (docs 10 §3.3)', () => {
    expect(ratioOf('light', 'status.partial-fg', 'status.partial-bg')).toBeCloseTo(5.36, 2);
    expect(ratioOf('light', 'border.control', 'bg.surface')).toBeCloseTo(4.92, 2);
    expect(ratioOf('dark', 'border.control', 'bg.surface')).toBeCloseTo(3.54, 2);
    expect(ratioOf('light', 'text.primary', 'bg.surface')).toBeCloseTo(17.39, 2);
  });

  it('keeps border.strong decorative only: it is below 3:1 on purpose', () => {
    expect(ratioOf('light', 'border.strong', 'bg.surface')).toBeLessThan(3);
    expect(ratioOf('dark', 'border.strong', 'bg.surface')).toBeLessThan(3);
  });

  it('fails loudly on an unknown token', () => {
    expect(() => auditContrast([{ fg: 'text.nope', bg: 'bg.surface', min: 4.5 }])).toThrow(
      'Unknown token',
    );
  });
});

describe('resolveSemanticColors', () => {
  it('uses the dark extension only in dark theme', () => {
    expect(resolveSemanticColors('light').get('bg.brand')).toBe('#154f37');
    expect(resolveSemanticColors('dark').get('bg.brand')).toBe('#43966e');
  });

  it('resolves every semantic colour in both themes', () => {
    expect(resolveSemanticColors('light').size).toBe(resolveSemanticColors('dark').size);
    expect(resolveSemanticColors('light').size).toBeGreaterThan(40);
  });
});

describe('createColorResolver guards', () => {
  const primitives = { color: { green: { '700': { $value: '#154F37' } } }, $description: 'x' };

  it('ignores metadata keys and non-object nodes', () => {
    const resolve = createColorResolver(primitives, {
      brand: { $value: '{color.green.700}' },
      note: 'x',
    });
    expect(resolve('dark').get('brand')).toBe('#154f37');
  });

  it('rejects raw values and unknown primitives', () => {
    expect(() => createColorResolver(primitives, { a: { $value: '#000000' } })('light')).toThrow(
      'must reference a primitive',
    );
    expect(() =>
      createColorResolver(primitives, { a: { $value: '{color.red.1}' } })('light'),
    ).toThrow('Unknown primitive color.red.1');
    expect(createColorResolver(null, {})('light').size).toBe(0);
  });
});
