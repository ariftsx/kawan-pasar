import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const fixtures = fileURLToPath(new URL('./fixtures/', import.meta.url));

async function lintFixture(name: string): Promise<string[]> {
  const eslint = new ESLint({
    cwd: fixtures,
    overrideConfigFile: fileURLToPath(new URL('./eslint.fixture.config.js', import.meta.url)),
  });
  const [result] = await eslint.lintFiles([name]);
  return (result?.messages ?? []).map((m) => m.ruleId ?? `fatal:${m.message}`);
}

describe('@kawan-pasar/eslint-config', () => {
  it('rejects explicit any and ts-ignore comments', async () => {
    const rules = await lintFixture('bad-any.ts');
    expect(rules).toContain('@typescript-eslint/no-explicit-any');
    expect(rules).toContain('@typescript-eslint/ban-ts-comment');
  });

  it('accepts clean strictly-typed code', async () => {
    expect(await lintFixture('good.ts')).toEqual([]);
  });
});
