import { describe, expect, it } from 'vitest';
import {
  ARTICLE_MAX_BYTES,
  DEFAULT_IMAGE_ORIGINS,
  articleBodyProblems,
  parseImageOrigins,
  readingMinutes,
} from './article-body.js';

const ORIGINS = ['https://upload.wikimedia.org', 'https://images.unsplash.com'];
const problems = (md: string): string[] => articleBodyProblems(md, ORIGINS);

describe('article body checks (Fase 3B, same parser as the public renderer)', () => {
  it('accepts plain text, https links, internal paths and fragments', () => {
    expect(
      problems(
        [
          '## Judul',
          'Teks dengan [sumber](https://www.bi.go.id/) dan [harga](/harga/bawang-merah).',
          'Lompat ke [bagian](#judul).',
          '![Pasar pagi](https://upload.wikimedia.org/a.jpg)',
        ].join('\n\n'),
      ),
    ).toEqual([]);
  });

  it('rejects unsafe or ambiguous links in every markdown form', () => {
    expect(problems('[x](javascript:alert(1))')).toEqual(['link']);
    expect(problems('[x](http://contoh.id)')).toEqual(['link']);
    expect(problems('[x](//evil.example/path)')).toEqual(['link']);
    expect(problems('[x](mailto:a@b.id)')).toEqual(['link']);
    // Reference-style definition and autolink are links too.
    expect(problems('[x][r]\n\n[r]: javascript:alert(1)')).toEqual(['link']);
    expect(problems('<http://contoh.id>')).toEqual(['link']);
  });

  it('checks the definition the renderer uses: the first one, like CommonMark (review finding)', () => {
    const body = ['[klik][x]', '', '[x]: //evil.example/phish', '[x]: https://ok.example'];
    expect(problems(body.join('\n'))).toEqual(['link']);
    // Identifiers are case-insensitive: [X] reuses the first [x].
    const mixed = ['[a][X]', '', '[x]: http://a.example', '[X]: https://b.example'];
    expect(problems(mixed.join('\n'))).toEqual(['link']);
  });

  it('allows images only from the configured https origins, with alt text', () => {
    expect(problems('![Foto](https://evil.example/a.jpg)')).toEqual(['image_origin']);
    expect(problems('![Foto](http://upload.wikimedia.org/a.jpg)')).toEqual(['image_origin']);
    expect(problems('![Foto](https://upload.wikimedia.org.evil.example/a.jpg)')).toEqual([
      'image_origin',
    ]);
    expect(problems('![](https://images.unsplash.com/a.jpg)')).toEqual(['image_alt']);
    expect(problems('![Foto][f]\n\n[f]: https://evil.example/a.jpg')).toEqual(['image_origin']);
  });

  it('reports raw HTML (it would be dropped silently), and the size limit', () => {
    expect(problems('Halo <b>tebal</b>')).toEqual(['html']);
    expect(problems('x'.repeat(ARTICLE_MAX_BYTES + 1))).toEqual(['size']);
    // UTF-8 bytes, not characters.
    expect(problems('é'.repeat(ARTICLE_MAX_BYTES / 2 + 1))).toEqual(['size']);
  });

  it('lists each problem once, in a fixed order', () => {
    expect(problems('<i>a</i> [x](http://a) [y](http://b) ![](https://evil.example/c)')).toEqual([
      'link',
      'image_origin',
      'image_alt',
      'html',
    ]);
  });

  it('estimates reading time at 200 words a minute, at least 1', () => {
    expect(readingMinutes('satu dua tiga')).toBe(1);
    expect(readingMinutes(Array.from({ length: 450 }, () => 'kata').join(' '))).toBe(3);
  });
});

describe('ARTICLE_IMAGE_ORIGINS', () => {
  it('defaults to Wikimedia and Unsplash; adds the team domain; https origins only', () => {
    expect(parseImageOrigins(undefined)).toEqual(DEFAULT_IMAGE_ORIGINS);
    expect(parseImageOrigins('')).toEqual(DEFAULT_IMAGE_ORIGINS);
    expect(parseImageOrigins(' https://upload.wikimedia.org , https://cdn.tim.example ')).toEqual([
      'https://upload.wikimedia.org',
      'https://cdn.tim.example',
    ]);
    expect(() => parseImageOrigins('http://cdn.tim.example')).toThrow(/https origin/);
    expect(() => parseImageOrigins('https://cdn.tim.example/gambar')).toThrow(/https origin/);
    expect(() => parseImageOrigins('*')).toThrow(/https origin/);
  });
});
