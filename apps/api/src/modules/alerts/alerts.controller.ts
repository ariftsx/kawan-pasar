import {
  AlertPreferencesSchema,
  MarkReadInputSchema,
  NotificationsQuerySchema,
  VerifyInputSchema,
  WatchIdSchema,
  WatchInputSchema,
  WatchUpdateSchema,
} from '@kawan-pasar/contracts';
import type {
  AlertPreferences,
  AlertsResponse,
  MarkReadInput,
  NotificationsResponse,
  NotificationTab,
  VerifyInput,
  WatchInput,
  WatchUpdate,
} from '@kawan-pasar/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext } from '../auth/auth.service.js';
import { Auth, CsrfGuard, SessionGuard } from '../auth/session.guard.js';
import type { AlertsService } from './alerts.service.js';

export const ALERTS_SERVICE = Symbol('ALERTS_SERVICE');
const NO_STORE = 'private, no-store';

/** The signed-in user's alert settings and watches. Changes need the session's CSRF token. */
@Controller('v1/alerts')
@UseGuards(SessionGuard, CsrfGuard)
export class AlertsController {
  constructor(@Inject(ALERTS_SERVICE) private readonly alerts: AlertsService) {}

  @Get()
  @Header('cache-control', NO_STORE)
  overview(@Auth() auth: AuthContext): Promise<AlertsResponse> {
    return this.alerts.overview(auth.session.userId);
  }

  @Put('preferences')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async preferences(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(AlertPreferencesSchema)) body: AlertPreferences,
  ): Promise<void> {
    await this.alerts.savePreferences(auth.session.userId, body);
  }

  @Post('watches')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async addWatch(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(WatchInputSchema)) body: WatchInput,
  ): Promise<void> {
    await this.alerts.addWatch(auth.session.userId, body);
  }

  @Patch('watches/:id')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async updateWatch(
    @Auth() auth: AuthContext,
    @Param('id', new ZodValidationPipe(WatchIdSchema)) id: number,
    @Body(new ZodValidationPipe(WatchUpdateSchema)) body: WatchUpdate,
  ): Promise<void> {
    await this.alerts.updateWatch(auth.session.userId, id, body);
  }

  @Delete('watches/:id')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async removeWatch(
    @Auth() auth: AuthContext,
    @Param('id', new ZodValidationPipe(WatchIdSchema)) id: number,
  ): Promise<void> {
    await this.alerts.removeWatch(auth.session.userId, id);
  }
}

/** In-app news of the signed-in user. */
@Controller('v1/notifications')
@UseGuards(SessionGuard, CsrfGuard)
export class NotificationsController {
  constructor(@Inject(ALERTS_SERVICE) private readonly alerts: AlertsService) {}

  @Get()
  @Header('cache-control', NO_STORE)
  list(
    @Auth() auth: AuthContext,
    @Query(new ZodValidationPipe(NotificationsQuerySchema))
    query: { tab: NotificationTab; before?: number },
  ): Promise<NotificationsResponse> {
    return this.alerts.notifications(auth.session.userId, query.tab, query.before);
  }

  @Get('unread-count')
  @Header('cache-control', NO_STORE)
  async unread(@Auth() auth: AuthContext): Promise<{ unread: number }> {
    return { unread: await this.alerts.unreadCount(auth.session.userId) };
  }

  @Post('read')
  @HttpCode(200)
  @Header('cache-control', NO_STORE)
  async markRead(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(MarkReadInputSchema)) body: MarkReadInput,
  ): Promise<{ marked: number }> {
    return { marked: await this.alerts.markRead(auth.session.userId, body) };
  }
}

/** The weekly summary e-mail's unsubscribe link (no session: the single-use token is enough). */
@Controller('v1/alerts/weekly')
export class WeeklyUnsubscribeController {
  constructor(@Inject(ALERTS_SERVICE) private readonly alerts: AlertsService) {}

  @Post('unsubscribe')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async unsubscribe(
    @Body(new ZodValidationPipe(VerifyInputSchema)) body: VerifyInput,
  ): Promise<void> {
    await this.alerts.unsubscribeWeekly(body.token);
  }
}
