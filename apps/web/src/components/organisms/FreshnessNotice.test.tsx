import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FreshnessNotice } from './FreshnessNotice';

afterEach(() => {
  vi.useRealTimers();
});

describe('FreshnessNotice', () => {
  it('warns when the visitor opens a cached page after the data went stale', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-07T10:00:00+07:00'));
    render(<FreshnessNotice latestObservedOn="2026-10-02" />);
    expect(screen.getByRole('status').textContent).toContain('Jum, 2 Okt 2026');
  });

  it('stays silent while the data is fresh', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T10:00:00+07:00'));
    const { container } = render(<FreshnessNotice latestObservedOn="2026-10-02" />);
    expect(container.textContent).toBe('');
  });

  it('is already in the server HTML when the data was stale at render time (works without JavaScript)', () => {
    const html = renderToString(<FreshnessNotice latestObservedOn="2026-09-30" staleAtRender />);
    expect(html).toContain('Harga belum diperbarui');
  });
});
