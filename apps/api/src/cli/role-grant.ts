// Grants or removes the Analyst role from the server (Fase 3A; the admin page arrives in 3B):
//   pnpm --filter @kawan-pasar/api role:grant <email> analyst
//   pnpm --filter @kawan-pasar/api role:grant <email> user        (removes the role)
// Never grants admin: that is `admin:grant` (3B). Exit codes: 0 done, 1 refused or not found.
import { EmailSchema } from '@kawan-pasar/contracts';
import pg from 'pg';
import { z } from 'zod';
import { createDb } from '../database/client.js';
import { grantRole } from './grant-role.js';

const Args = z.tuple([EmailSchema, z.enum(['analyst', 'user'])]);

async function main(): Promise<number> {
  const args = Args.safeParse(process.argv.slice(2));
  if (!args.success) {
    process.stderr.write(
      'usage: role:grant <email> <analyst|user>  (admin only through admin:grant)\n',
    );
    return 1;
  }
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    process.stderr.write('missing env DATABASE_URL\n');
    return 1;
  }
  const pool = new pg.Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 5_000 });
  try {
    const [email, role] = args.data;
    const result = await grantRole(createDb(pool), email, role);
    process.stdout.write(`${result}\n`);
    return result === 'not_found' || result === 'refused_admin' ? 1 : 0;
  } finally {
    await pool.end();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`role:grant failed: ${e instanceof Error ? e.name : 'error'}\n`);
    process.exitCode = 1;
  },
);
