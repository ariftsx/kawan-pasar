// Makes an account admin or returns it to a plain user, from the server only (Fase 3B):
//   pnpm --filter @kawan-pasar/api admin:grant <email>
//   pnpm --filter @kawan-pasar/api admin:revoke <email>
// The web never grants or removes admin. Exit codes: 0 done, 1 not found or bad input.
import { EmailSchema } from '@kawan-pasar/contracts';
import pg from 'pg';
import { z } from 'zod';
import { createDb } from '../database/client.js';
import { grantAdmin } from './grant-admin.js';

const Args = z.tuple([z.enum(['grant', 'revoke']), EmailSchema]);

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
    const [action, email] = args.data;
    const result = await grantAdmin(createDb(pool), email, action);
    process.stdout.write(`${result}\n`);
    return result === 'not_found' ? 1 : 0;
  } finally {
    await pool.end();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`admin CLI failed: ${e instanceof Error ? e.name : 'error'}\n`);
    process.exitCode = 1;
  },
);
