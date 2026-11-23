import {
  AdminConfirmInputSchema,
  AdminDecisionInputSchema,
  AdminUserSearchInputSchema,
  maskEmail,
} from '@kawan-pasar/contracts';
import type {
  AdminConfirmInput,
  AdminDecisionInput,
  AdminMonitoringResponse,
  AdminRequestsResponse,
  AdminStatusResponse,
  AdminUserSearchInput,
  AdminUserSearchResponse,
} from '@kawan-pasar/contracts';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Clock } from '../../common/clock.js';
import { CLOCK } from '../../common/clock.js';
import { conflict, forbidden, notFound } from '../../common/api-errors.js';
import { MAIL_OUTBOX } from '../mail/mail.queue.js';
import type { MailOutbox } from '../mail/mail.queue.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext, AuthService, Caller } from '../auth/auth.service.js';
import { Auth, CallerInfo, CsrfGuard, SessionGuard } from '../auth/session.guard.js';
import { AUTH_SERVICE } from '../auth/tokens.js';
import type { AdminSessions } from './admin-session.js';
import { ADMIN_SESSIONS, ADMIN_USERS, AdminGuard, RequiresConfirmation } from './admin.guard.js';
import type { UsersRepository } from '../auth/users.repository.js';
import type { AdminRepository } from './admin.repository.js';
import type { QueueStats } from './queue-stats.js';

export const ADMIN_QUEUE_STATS = Symbol('ADMIN_QUEUE_STATS');
const DAY_MS = 86_400_000;

export const ADMIN_REPOSITORY = Symbol('ADMIN_REPOSITORY');
const NO_STORE = 'private, no-store';

/** The admin's session state and password confirmation (Fase 3B). */
@Controller('v1/admin')
@UseGuards(SessionGuard, CsrfGuard, AdminGuard)
export class AdminController {
  constructor(
    @Inject(ADMIN_SESSIONS) private readonly sessions: AdminSessions,
    @Inject(AUTH_SERVICE) private readonly auth: AuthService,
    @Inject(ADMIN_REPOSITORY) private readonly repo: AdminRepository,
    @Inject(MAIL_OUTBOX) private readonly outbox: MailOutbox,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(ADMIN_USERS) private readonly users: UsersRepository,
    @Inject(ADMIN_QUEUE_STATS) private readonly queues: QueueStats,
  ) {}

  @Get()
  @Header('cache-control', NO_STORE)
  async status(@Auth() auth: AuthContext): Promise<AdminStatusResponse> {
    const until = await this.sessions.confirmedUntil(auth.session.id);
    return { confirmedUntil: until === null ? null : until.toISOString() };
  }

  /** Re-enter the password: opens a 10-minute window for changes. Counts toward the lockout. */
  @Post('confirm')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async confirm(
    @Auth() auth: AuthContext,
    @CallerInfo() caller: Caller,
    @Body(new ZodValidationPipe(AdminConfirmInputSchema)) body: AdminConfirmInput,
  ): Promise<void> {
    await this.auth.reauthenticate(auth, body.password, caller);
    await this.sessions.confirm(auth.session.id);
    await this.repo.audit(auth.session.userId, 'admin_confirm', null);
  }

  /** Pending Analyst requests, oldest first, with masked e-mail addresses (task 3). */
  @Get('requests')
  @Header('cache-control', NO_STORE)
  async requests(): Promise<AdminRequestsResponse> {
    const rows = await this.repo.pendingRequests();
    return {
      items: rows.map((r) => ({
        id: r.id,
        email: maskEmail(r.email),
        reason: r.reason,
        organization: r.organization,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  @Post('requests/:id/decision')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async decide(
    @Auth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(AdminDecisionInputSchema)) body: AdminDecisionInput,
  ): Promise<void> {
    const note = body.note ?? null;
    const result = await this.repo.decide(
      id,
      auth.session.userId,
      body.decision,
      note,
      this.clock.now(),
    );
    if (!result.ok) {
      if (result.why === 'not_found') throw notFound();
      if (result.why === 'self') throw forbidden();
      throw conflict('decided');
    }
    // Queued after the commit: a decision that failed never sends an e-mail.
    await this.outbox.send(
      body.decision === 'approve'
        ? { template: 'analyst_approved', to: result.email }
        : {
            template: 'analyst_rejected',
            to: result.email,
            ...(note === null ? {} : { lines: [note] }),
          },
    );
  }

  /** One account by its exact e-mail (task 4). POST: the address travels in the body, not the URL. */
  @Post('users/search')
  @HttpCode(200)
  @Header('cache-control', NO_STORE)
  async searchUser(
    @Body(new ZodValidationPipe(AdminUserSearchInputSchema)) body: AdminUserSearchInput,
  ): Promise<AdminUserSearchResponse> {
    const user = await this.users.findByEmail(body.email);
    return {
      user:
        user === null
          ? null
          : {
              id: user.id,
              email: maskEmail(user.email),
              role: user.role,
              emailVerified: user.emailVerifiedAt !== null,
              createdAt: user.createdAt.toISOString(),
            },
    };
  }

  @Post('users/:id/revoke-analyst')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  @RequiresConfirmation()
  async revokeAnalyst(
    @Auth() auth: AuthContext,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const result = await this.repo.revokeAnalyst(id, auth.session.userId);
    if (result === 'not_found') throw notFound();
    if (result === 'protected') throw forbidden();
    if (result === 'not_analyst') throw conflict('role');
  }

  /** Read-only operations view (task 5). */
  @Get('monitoring')
  @Header('cache-control', NO_STORE)
  async monitoring(): Promise<AdminMonitoringResponse> {
    const [runs, bundles, queues] = await Promise.all([
      this.repo.ingestRuns(),
      this.repo.bundles(),
      this.queues.counts(),
    ]);
    const now = this.clock.now().getTime();
    return {
      ingestRuns: runs.map((r) => ({
        id: r.id,
        source: r.source,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        finishedAt: r.finishedAt === null ? null : r.finishedAt.toISOString(),
        rowsInserted: r.rowsInserted,
        rowsSkipped: r.rowsSkipped,
        rowsRejected: r.rowsRejected,
        error: r.error === null ? null : r.error.slice(0, 300),
      })),
      bundles: bundles.map((b) => ({
        bundleId: b.bundleId,
        modelName: b.modelName,
        modelVersion: b.modelVersion,
        status: b.status,
        isDemo: b.isDemo,
        issuedAt: b.issuedAt.toISOString(),
        ageDays: Math.max(0, Math.floor((now - b.issuedAt.getTime()) / DAY_MS)),
        rejectReasons: b.rejectReasons ?? [],
      })),
      queues,
    };
  }
}
