import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ArticleBody, headingsOf, slugify } from './ArticleBody';

describe('ArticleBody', () => {
  it('renders the allowed Markdown subset with heading ids for the table of contents', () => {
    const { container } = render(
      <ArticleBody
        markdown={'## Inflasi, singkatnya\n\nTeks **tebal** dan _miring_.\n\n1. satu\n2. dua'}
      />,
    );
    expect(container.querySelector('h2#inflasi-singkatnya')?.textContent).toBe(
      'Inflasi, singkatnya',
    );
    expect(container.querySelector('strong')?.textContent).toBe('tebal');
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
  });

  it('never renders raw HTML, scripts or event handlers', () => {
    const { container } = render(
      <ArticleBody
        markdown={
          'Halo <script>alert(1)</script> <img src=x onerror="alert(2)"> <b onclick="x()">b</b>\n\n<iframe src="https://evil"></iframe>'
        }
      />,
    );
    expect(container.querySelector('script, img, iframe, b')).toBeNull();
    expect(container.innerHTML).not.toMatch(/onerror|onclick/);
  });

  it('drops dangerous link targets and hardens external links', () => {
    render(
      <ArticleBody
        markdown={
          '[jahat](javascript:alert(1)) [data](data:text/html,x) [luar](https://www.bps.go.id) [dalam](/harga)'
        }
      />,
    );
    expect(screen.queryByRole('link', { name: 'jahat' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'data' })).toBeNull();
    const external = screen.getByRole('link', { name: /luar/ });
    expect(external.getAttribute('rel')).toBe('noopener noreferrer');
    expect(external.getAttribute('target')).toBe('_blank');
    expect(screen.getByRole('link', { name: 'dalam' }).getAttribute('target')).toBeNull();
  });

  it('turns images and unlisted elements into plain text', () => {
    const { container } = render(
      <ArticleBody markdown={'![alt](https://x/y.png)\n\n| a |\n|---|\n| b |'} />,
    );
    expect(container.querySelector('img, table')).toBeNull();
  });
});

describe('headingsOf / slugify', () => {
  it('lists level-2 headings with the same ids the body uses', () => {
    expect(headingsOf('## Satu\n\nteks\n\n### sub\n\n## Dua, tiga?')).toEqual([
      { id: 'satu', text: 'Satu' },
      { id: 'dua-tiga', text: 'Dua, tiga?' },
    ]);
    expect(slugify('Apa dampaknya ke pengeluaran Anda?')).toBe('apa-dampaknya-ke-pengeluaran-anda');
  });
});
