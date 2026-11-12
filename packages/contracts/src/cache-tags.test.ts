import { describe, expect, it } from 'vitest';
import { cacheTags as tagsFor, parseCacheTag as parseTag } from './cache-tags.js';

describe('cache tags', () => {
  it('builds tags from market and commodity codes', () => {
    expect(tagsFor.prices('PIKJ')).toBe('prices:PIKJ');
    expect(tagsFor.history('PIKJ', 'bawang-merah')).toBe('history:PIKJ:bawang-merah');
  });

  it('accepts only known tag shapes', () => {
    expect(parseTag('history:PIKJ:bawang-merah')).toBe('history:PIKJ:bawang-merah');
    expect(parseTag('articles')).toBe('articles');
    expect(parseTag('article:apa-itu-inflasi')).toBe('article:apa-itu-inflasi');
    expect(parseTag('prices:PIKJ;drop')).toBeNull();
    expect(parseTag('prices:XXXX')).toBeNull();
    expect(parseTag('history:PIKJ:kopi')).toBeNull();
    expect(parseTag(`article:${'a'.repeat(300)}`)).toBeNull();
  });
});
