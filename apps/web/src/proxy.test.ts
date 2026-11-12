import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, proxy } from './proxy';

const run = (path: string) => proxy(new NextRequest(`http://web:3000${path}`));

describe('proxy', () => {
  it('lets known markets through', () => {
    expect(run('/PIKJ/pasar').status).toBe(200);
    expect(run('/PIKJ/pasar').headers.get('x-middleware-next')).toBe('1');
  });

  it('answers unknown market segments with 404 before any render or cache entry', () => {
    const res = run('/ZZZZ/pasar');
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  it('only runs on market-scoped data routes', () => {
    expect(config.matcher).toEqual(['/:market/pasar']);
  });
});
