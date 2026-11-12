import { describe, expect, it } from 'vitest';
import { parseArticleFile } from '../../src/database/seed/article-file.js';

const valid = `---
slug: apa-itu-inflasi-pangan
category: dasar
title: Apa itu inflasi pangan?
summary: Ringkasan singkat.
readingMinutes: 5
status: published
order: 1
---

## Inflasi, singkatnya

Isi artikel.
`;

describe('parseArticleFile', () => {
  it('parses front matter and keeps the Markdown body', () => {
    const article = parseArticleFile(valid, 'a.md');
    expect(article).toMatchObject({
      slug: 'apa-itu-inflasi-pangan',
      category: 'dasar',
      readingMinutes: 5,
      status: 'published',
      order: 1,
    });
    expect(article.bodyMd.trim()).toBe('## Inflasi, singkatnya\n\nIsi artikel.');
  });

  it('accepts Windows line endings', () => {
    expect(parseArticleFile(valid.replace(/\n/g, '\r\n'), 'a.md').slug).toBe(
      'apa-itu-inflasi-pangan',
    );
  });

  it('names the file and the missing field when front matter is invalid', () => {
    expect(() =>
      parseArticleFile(valid.replace('slug: apa-itu-inflasi-pangan\n', ''), 'rusak.md'),
    ).toThrow(/rusak\.md.*slug/);
  });

  it('rejects an unknown status', () => {
    expect(() =>
      parseArticleFile(valid.replace('status: published', 'status: live'), 'x.md'),
    ).toThrow(/x\.md.*status/);
  });

  it('rejects a file without front matter', () => {
    expect(() => parseArticleFile('# judul saja', 'kosong.md')).toThrow(/kosong\.md/);
  });
});
