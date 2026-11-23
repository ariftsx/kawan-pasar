import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Queue } from 'bullmq';
import type pg from 'pg';
import type { MailJob } from '../../src/modules/mail/mail.queue.js';
import { serviceToken } from './test-app.js';

export const PASSWORD = 'pasar kramat jati pagi hari';

export interface Reply {
  status: number;
  body: string;
  headers: Record<string, string | string[] | number | undefined>;
  json: () => Record<string, unknown>;
}

export interface Caller {
  session?: string;
  csrf?: string;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** One API call as the BFF makes it (service token, forwarded visitor address). */
export async function call(
  app: NestFastifyApplication,
  method: Method,
  url: string,
  o: Caller & { body?: unknown } = {},
): Promise<Reply> {
  const res = await app.inject({
    method,
    url,
    headers: {
      'x-service-token': serviceToken(),
      'x-forwarded-for': '10.7.7.7',
      ...(o.session === undefined ? {} : { 'x-session-token': o.session }),
      ...(o.csrf === undefined ? {} : { 'x-csrf-token': o.csrf }),
    },
    ...(o.body === undefined ? {} : { payload: o.body as object }),
  });
  return {
    status: res.statusCode,
    body: res.body,
    headers: res.headers,
    json: () => res.json<Record<string, unknown>>(),
  };
}

export interface Account {
  email: string;
  id: string;
  session: string;
  csrf: string;
}

/** Registers, verifies (unless told not to) and signs in; optionally sets the role directly. */
export async function account(
  app: NestFastifyApplication,
  mail: Queue<MailJob>,
  owner: pg.Pool,
  email: string,
  options: { verify?: boolean; role?: 'user' | 'analyst' | 'admin' } = {},
): Promise<Account> {
  await call(app, 'POST', '/v1/auth/register', {
    body: { email, password: PASSWORD, acceptPrivacy: true },
  });
  if (options.verify !== false) {
    const jobs = await mail.getJobs(['waiting', 'delayed', 'completed', 'failed', 'active']);
    const v = jobs.map((j) => j.data).find((d) => d.template === 'verify_email' && d.to === email);
    await call(app, 'POST', '/v1/auth/verify-email', { body: { token: v?.token } });
  }
  if (options.role !== undefined) {
    await owner.query('UPDATE users SET role = $2 WHERE email = $1', [email, options.role]);
  }
  const login = (
    await call(app, 'POST', '/v1/auth/login', { body: { email, password: PASSWORD } })
  ).json();
  const id = (await owner.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]))
    .rows[0]?.id;
  return { email, id: id ?? '', session: String(login['token']), csrf: String(login['csrf']) };
}
