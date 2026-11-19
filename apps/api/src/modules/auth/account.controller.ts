import {
  ChangePasswordInputSchema,
  DeleteAccountInputSchema,
  PhoneInputSchema,
  SessionIdSchema,
} from '@kawan-pasar/contracts';
import type {
  ChangePasswordInput,
  DeleteAccountInput,
  MeResponse,
  PhoneInput,
  SessionsResponse,
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
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { notFound } from '../../common/api-errors.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext, AuthService, Caller } from './auth.service.js';
import { Auth, CallerInfo, CsrfGuard, SessionGuard } from './session.guard.js';
import { AUTH_SERVICE } from './tokens.js';

const NO_STORE = 'private, no-store';

/** The signed-in user's own account. Every route needs a session; changes also need CSRF. */
@Controller('v1/me')
@UseGuards(SessionGuard, CsrfGuard)
export class AccountController {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: AuthService) {}

  @Get()
  @Header('cache-control', NO_STORE)
  me(@Auth() auth: AuthContext): Promise<MeResponse> {
    return this.auth.me(auth);
  }

  @Post('password')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async changePassword(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(ChangePasswordInputSchema)) body: ChangePasswordInput,
    @CallerInfo() caller: Caller,
  ): Promise<void> {
    await this.auth.changePassword(auth, body, caller);
  }

  @Put('phone')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async setPhone(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(PhoneInputSchema)) body: PhoneInput,
    @CallerInfo() caller: Caller,
  ): Promise<void> {
    await this.auth.setPhone(auth, body.phone, caller);
  }

  @Delete('phone')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async removePhone(@Auth() auth: AuthContext, @CallerInfo() caller: Caller): Promise<void> {
    await this.auth.setPhone(auth, null, caller);
  }

  @Get('sessions')
  @Header('cache-control', NO_STORE)
  sessions(@Auth() auth: AuthContext): Promise<SessionsResponse> {
    return this.auth.listSessions(auth);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async revokeSession(
    @Auth() auth: AuthContext,
    @Param('id', new ZodValidationPipe(SessionIdSchema)) id: string,
    @CallerInfo() caller: Caller,
  ): Promise<void> {
    if (!(await this.auth.revokeSession(auth, id, caller))) throw notFound();
  }

  @Delete()
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async deleteAccount(
    @Auth() auth: AuthContext,
    @Body(new ZodValidationPipe(DeleteAccountInputSchema)) body: DeleteAccountInput,
    @CallerInfo() caller: Caller,
  ): Promise<void> {
    await this.auth.deleteAccount(auth, body, caller);
  }
}
