import { WhatsAppInboundSchema, WhatsAppVerifyInputSchema } from '@kawan-pasar/contracts';
import type {
  WhatsAppInbound,
  WhatsAppResponse,
  WhatsAppVerifyInput,
} from '@kawan-pasar/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext, Caller } from '../auth/auth.service.js';
import { Auth, CallerInfo, CsrfGuard, SessionGuard } from '../auth/session.guard.js';
import type { WhatsAppService } from './whatsapp.service.js';

export const WHATSAPP_SERVICE = Symbol('WHATSAPP_SERVICE');
const NO_STORE = 'private, no-store';

/** The signed-in user's WhatsApp channel (Fase 2C). Changes need the session's CSRF token. */
@Controller('v1/whatsapp')
@UseGuards(SessionGuard, CsrfGuard)
export class WhatsAppController {
  constructor(@Inject(WHATSAPP_SERVICE) private readonly wa: WhatsAppService) {}

  @Get()
  @Header('cache-control', NO_STORE)
  status(@Auth() auth: AuthContext): Promise<WhatsAppResponse> {
    return this.wa.status(auth.session.userId);
  }

  @Post('code')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async sendCode(@Auth() auth: AuthContext): Promise<void> {
    await this.wa.sendCode(auth.session.userId);
  }

  @Post('verify')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async verify(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(WhatsAppVerifyInputSchema)) body: WhatsAppVerifyInput,
    @CallerInfo() caller: Caller,
  ): Promise<void> {
    await this.wa.verify(auth.session.userId, body.code, caller.ip);
  }

  @Delete()
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async disconnect(@Auth() auth: AuthContext): Promise<void> {
    await this.wa.disconnect(auth.session.userId);
  }
}

/**
 * Mock of the provider's inbound webhook (service token, like every internal route). A real
 * adapter would verify the provider's signature here. Always answers the same.
 */
@Controller('internal/whatsapp')
export class WhatsAppInboundController {
  constructor(@Inject(WHATSAPP_SERVICE) private readonly wa: WhatsAppService) {}

  @Post('inbound')
  @HttpCode(200)
  async inbound(
    @Body(new ZodValidationPipe(WhatsAppInboundSchema)) body: WhatsAppInbound,
  ): Promise<{ ok: true }> {
    await this.wa.inbound(body.from, body.text);
    return { ok: true };
  }
}
