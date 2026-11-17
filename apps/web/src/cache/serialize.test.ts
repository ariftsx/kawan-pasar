// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { decode, encode } from './serialize.js';

const roundTrip = (value: unknown): unknown => decode(encode(value));

describe('cache entry serialization', () => {
  it('keeps an App Router page entry byte-identical (html, RSC payload, segments, headers, status)', () => {
    const rsc = Buffer.from([0, 1, 2, 250, 255, 10, 13]);
    const page = {
      kind: 'APP_PAGE',
      html: '<!DOCTYPE html><p>Harga ✓ Rp 45.000</p>',
      rscData: rsc,
      headers: { 'x-next-cache-tags': 'prices:PIKJ,_N_T_/PIKJ/beranda', vary: 'rsc' },
      postponed: undefined,
      status: 200,
      segmentData: new Map([
        ['/_tree', Buffer.from('tree')],
        ['/PIKJ/beranda.segment', Buffer.from([9, 8, 7])],
      ]),
    };
    const back = roundTrip(page) as typeof page;
    expect(back.html).toBe(page.html);
    expect(Buffer.isBuffer(back.rscData)).toBe(true);
    expect(back.rscData.equals(rsc)).toBe(true);
    expect(back.segmentData).toBeInstanceOf(Map);
    expect([...back.segmentData.keys()]).toEqual(['/_tree', '/PIKJ/beranda.segment']);
    expect(back.segmentData.get('/PIKJ/beranda.segment')?.equals(Buffer.from([9, 8, 7]))).toBe(
      true,
    );
    expect(back.headers).toEqual(page.headers);
    expect(back.status).toBe(200);
  });

  it('keeps a route handler entry (binary body) and a 404 page entry', () => {
    const route = {
      kind: 'APP_ROUTE',
      body: Buffer.from('<?xml?><urlset/>'),
      status: 200,
      headers: {},
    };
    const back = roundTrip(route) as typeof route;
    expect(back.body.equals(route.body)).toBe(true);

    const notFound = { kind: 'APP_PAGE', html: '<p>tidak ditemukan</p>', status: 404, headers: {} };
    expect(roundTrip(notFound)).toEqual(notFound);
  });

  it('keeps a data-cache (fetch) entry and a null value', () => {
    const fetchEntry = {
      kind: 'FETCH',
      data: {
        headers: { 'content-type': 'application/json' },
        body: 'eyJkYXRhIjpbXX0=',
        status: 200,
        url: 'http://api:3001/v1/x',
      },
      revalidate: 600,
      tags: ['prices:PIKJ'],
    };
    expect(roundTrip(fetchEntry)).toEqual(fetchEntry);
    expect(roundTrip({ lastModified: 1, value: null })).toEqual({ lastModified: 1, value: null });
  });

  it('does not mistake a plain object that uses the marker key for an encoded value', () => {
    const tricky = { $kp: 'buf', v: 'AAAA' };
    expect(roundTrip(tricky)).toEqual(tricky);
  });
});
