import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

/**
 * Bundled list (data/breached-passwords.txt.gz): passwords of 12–128 characters from the
 * SecLists "Pwdb top 1 000 000" and "NCSC 100k" lists (MIT, see data/README.md). Shorter ones are
 * rejected by length anyway. Compared without case, so "KawanPasar123" counts as "kawanpasar123".
 */
const BUNDLED = fileURLToPath(new URL('../../../data/breached-passwords.txt.gz', import.meta.url));

export class BreachedPasswords {
  private constructor(private readonly entries: ReadonlySet<string>) {}

  static fromFile(file: string): BreachedPasswords {
    const lines = gunzipSync(readFileSync(file)).toString('utf8').split(/\r?\n/);
    return new BreachedPasswords(
      new Set(lines.filter((l) => l !== '').map((l) => l.toLowerCase())),
    );
  }

  static bundled(): BreachedPasswords {
    return BreachedPasswords.fromFile(BUNDLED);
  }

  get size(): number {
    return this.entries.size;
  }

  has(password: string): boolean {
    return this.entries.has(password.toLowerCase());
  }
}
