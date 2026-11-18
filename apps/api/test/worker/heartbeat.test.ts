import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isAlive, writeHeartbeat } from '../../src/worker/heartbeat.js';

const dirs: string[] = [];
const tempFile = (): string => {
  const dir = mkdtempSync(path.join(tmpdir(), 'kp-hb-'));
  dirs.push(dir);
  return path.join(dir, 'heartbeat');
};

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('worker heartbeat', () => {
  it('is alive right after a beat and dead once the beat is older than the limit', () => {
    const file = tempFile();
    writeHeartbeat(file, 1_000_000);
    expect(isAlive(file, 30_000, 1_020_000)).toBe(true);
    expect(isAlive(file, 30_000, 1_030_001)).toBe(false);
  });

  it('is dead without a heartbeat file or with a corrupt one', () => {
    const file = tempFile();
    expect(isAlive(file, 30_000, 1)).toBe(false);
    writeFileSync(file, 'not a number');
    expect(isAlive(file, 30_000, 1)).toBe(false);
  });
});
