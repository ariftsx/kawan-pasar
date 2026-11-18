// Background worker (same image as the API, no HTTP port). Processes the job queues on
// valkey-queue: e-mail in Fase 2A, alerts and the weekly summary from Fase 2B.
import { EnvValidationError, loadEnv } from './config/env.js';
import { createDb } from './database/client.js';
import { createPool } from './database/database.module.js';
import { pruneAccountData } from './modules/maintenance/retention.js';
import { AuthTokenService } from './modules/auth/auth-token.service.js';
import { UsersRepository } from './modules/auth/users.repository.js';
import { resolveForgot } from './modules/mail/forgot.js';
import { startMailWorker } from './modules/mail/mail.worker.js';
import { HEARTBEAT_FILE, HEARTBEAT_INTERVAL_MS, writeHeartbeat } from './worker/heartbeat.js';

const writeLine = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

function log(level: 'info' | 'error', msg: string): void {
  writeLine(JSON.stringify({ level, time: new Date().toISOString(), service: 'worker', msg }));
}

function main(): void {
  const env = loadEnv(process.env);
  const pool = createPool(env);
  const db = createDb(pool);
  const clock = { now: () => new Date() };
  const mail = startMailWorker({
    queueUrl: env.VALKEY_QUEUE_URL,
    smtpUrl: env.SMTP_URL,
    from: env.MAIL_FROM,
    siteUrl: env.PUBLIC_SITE_URL,
    log: writeLine,
    resolve: (job) =>
      resolveForgot(job, {
        users: new UsersRepository(db, env.AUTH_SECRET),
        tokens: new AuthTokenService(db, clock),
        now: clock.now,
      }),
  });

  // Retention (privacy page): at start, then daily. Idempotent, so several workers are fine.
  const prune = (): void => {
    pruneAccountData(db, new Date()).then(
      (r) => {
        writeLine(
          JSON.stringify({
            level: 'info',
            time: new Date().toISOString(),
            service: 'worker',
            msg: 'retention',
            events: r.events,
            tokens: r.tokens,
          }),
        );
      },
      (e: unknown) => {
        log('error', `retention failed: ${e instanceof Error ? e.name : 'error'}`);
      },
    );
  };
  prune();
  const daily = setInterval(prune, 24 * 3_600_000);

  writeHeartbeat(HEARTBEAT_FILE);
  const beat = setInterval(() => {
    writeHeartbeat(HEARTBEAT_FILE);
  }, HEARTBEAT_INTERVAL_MS);
  log('info', 'worker started');

  const stop = (): void => {
    clearInterval(beat);
    clearInterval(daily);
    // Let running jobs finish (BullMQ close waits for them), then exit.
    Promise.all([mail.close(), pool.end()]).then(
      () => {
        log('info', 'worker stopped');
        process.exit(0);
      },
      () => process.exit(1),
    );
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

try {
  main();
} catch (e: unknown) {
  const message = e instanceof EnvValidationError ? e.message : 'worker failed to start';
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
