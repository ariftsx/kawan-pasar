import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HighlightCards } from './HighlightCards';

describe('HighlightCards', () => {
  it('is a named section, so its card titles do not skip a heading level after the page title', () => {
    render(<HighlightCards highlights={{ topRise: null, topFall: null, forecast: null }} />);
    const heading = screen.getByRole('heading', { level: 2, name: 'Sorotan minggu ini' });
    const section = screen.getByRole('region', { name: 'Sorotan minggu ini' });
    expect(section.contains(heading)).toBe(true);
    expect(section.querySelectorAll('h3')).toHaveLength(3);
  });
});
