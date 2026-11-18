import type { AuthTokenService } from '../auth/auth-token.service.js';
import type { UsersRepository } from '../auth/users.repository.js';
import type { MailJob } from './mail.queue.js';

export interface ForgotDeps {
  users: UsersRepository;
  tokens: AuthTokenService;
  now: () => Date;
}

/**
 * Resolves a queued "forgot password" request in the worker (Fase 2A review I2). The API answers
 * every address with the same single enqueue, so the response time cannot reveal whether an
 * account exists; the lookup, the token and the audit event happen here, out of band.
 *
 * Returns the e-mail to send (a reset link), null when the address has no account, or the job
 * unchanged for any other template.
 */
export async function resolveForgot(job: MailJob, deps: ForgotDeps): Promise<MailJob | null> {
  if (job.template !== 'forgot_password') return job;
  if (job.to === undefined) return null;
  const user = await deps.users.findByEmail(job.to);
  if (user === null) return null;
  const token = await deps.tokens.issue(user.id, 'reset_password');
  await deps.users.recordEvent(user.id, 'reset_request', job.ip ?? '0.0.0.0', deps.now());
  return { template: 'reset_password', to: user.email, token };
}
