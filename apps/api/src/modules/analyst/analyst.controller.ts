import { AnalystRequestInputSchema, ExportQuerySchema } from '@kawan-pasar/contracts';
import type {
  AnalystRequestInput,
  AnalystStatusResponse,
  ExportQuery,
} from '@kawan-pasar/contracts';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Injectable,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { forbidden, unauthenticated } from '../../common/api-errors.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.service.js';
import { Auth, CsrfGuard, SessionGuard, sessionOf } from '../auth/session.guard.js';
import type { UsersRepository } from '../auth/users.repository.js';
import type { AnalystService } from './analyst.service.js';

export const ANALYST_SERVICE = Symbol('ANALYST_SERVICE');
export const ANALYST_USERS = Symbol('ANALYST_USERS');
const NO_STORE = 'private, no-store';
/** Byte order mark: spreadsheet apps then read the file as UTF-8. */
const BOM = String.fromCharCode(0xfeff);

/**
 * Analyst (or admin) role, read from the database on every request: a revoked role stops
 * working at once, whatever the session says. Runs after SessionGuard.
 */
@Injectable()
export class AnalystRoleGuard implements CanActivate {
  constructor(@Inject(ANALYST_USERS) private readonly users: UsersRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const auth = sessionOf(context.switchToHttp().getRequest<FastifyRequest>());
    if (auth === null) throw unauthenticated();
    const user = await this.users.findById(auth.session.userId);
    if (user === null) throw unauthenticated();
    if (user.role !== 'analyst' && user.role !== 'admin') throw forbidden();
    return true;
  }
}

/** The user's role and analyst request (session + CSRF for the request). */
@Controller('v1/analyst')
@UseGuards(SessionGuard, CsrfGuard)
export class AnalystController {
  constructor(@Inject(ANALYST_SERVICE) private readonly analyst: AnalystService) {}

  @Get()
  @Header('cache-control', NO_STORE)
  status(@Auth() auth: AuthContext): Promise<AnalystStatusResponse> {
    return this.analyst.status(auth.session.userId);
  }

  @Post('request')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async request(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(AnalystRequestInputSchema)) body: AnalystRequestInput,
  ): Promise<void> {
    await this.analyst.request(auth.session.userId, body);
  }
}

/** CSV downloads of Mode Analis (analyst role). */
@Controller('v1/analyst/export')
@UseGuards(SessionGuard, AnalystRoleGuard)
export class AnalystExportController {
  constructor(@Inject(ANALYST_SERVICE) private readonly analyst: AnalystService) {}

  private send(reply: FastifyReply, name: string, csv: string): void {
    void reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${name}"`)
      .header('cache-control', NO_STORE)
      .header('x-content-type-options', 'nosniff')
      .send(BOM + csv);
  }

  @Get('prices.csv')
  async prices(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(ExportQuerySchema)) q: ExportQuery,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    this.send(reply, 'kawan-pasar-harga.csv', await this.analyst.pricesCsv(auth.session.userId, q));
  }

  @Get('forecasts.csv')
  async forecasts(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(ExportQuerySchema)) q: ExportQuery,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    this.send(
      reply,
      'kawan-pasar-prediksi.csv',
      await this.analyst.forecastsCsv(auth.session.userId, q),
    );
  }
}
