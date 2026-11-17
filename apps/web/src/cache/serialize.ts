// JSON encoding for Next.js cache entries. Entries hold binary RSC payloads (Buffer) and segment
// maps (Map<string, Buffer>), which plain JSON would turn into number arrays or drop entirely.
// Encoded forms are tagged objects: { $kp: 'buf' | 'map' | 'obj', v }. A plain object that
// itself uses the `$kp` key is wrapped as 'obj' so it can never be mistaken for an encoded value.

const MARK = '$kp';

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && Object.getPrototypeOf(value) === Object.prototype
  );
}

function toJson(value: unknown): Json | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Uint8Array) {
    return {
      [MARK]: 'buf',
      v: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64'),
    };
  }
  if (value instanceof Map) {
    const entries: Json[] = [];
    for (const [k, v] of value as Map<unknown, unknown>)
      entries.push([toJson(k) ?? null, toJson(v) ?? null]);
    return { [MARK]: 'map', v: entries };
  }
  if (Array.isArray(value)) return value.map((v: unknown) => toJson(v) ?? null);
  if (isPlainObject(value)) {
    const out: Record<string, Json> = {};
    for (const [k, v] of Object.entries(value)) {
      const encoded = toJson(v);
      if (encoded !== undefined) out[k] = encoded;
    }
    return MARK in out ? { [MARK]: 'obj', v: Object.entries(out) } : out;
  }
  // undefined, functions, symbols: dropped like JSON.stringify does.
  return undefined;
}

export function encode(value: unknown): string {
  return JSON.stringify(toJson(value) ?? null);
}

function revive(_key: string, value: unknown): unknown {
  if (!isPlainObject(value) || Object.keys(value).length !== 2) return value;
  const kind = value[MARK];
  const v = value['v'];
  if (kind === 'buf' && typeof v === 'string') return Buffer.from(v, 'base64');
  if (kind === 'map' && Array.isArray(v)) return new Map(v as [unknown, unknown][]);
  if (kind === 'obj' && Array.isArray(v)) return Object.fromEntries(v as [string, unknown][]);
  return value;
}

/** Inverse of `encode`. Throws on malformed JSON (callers treat that as a cache miss). */
export function decode(text: string): unknown {
  return JSON.parse(text, revive);
}
