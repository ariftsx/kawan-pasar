import {
  ForgotInputSchema,
  LoginInputSchema,
  RegisterInputSchema,
  ResetInputSchema,
  VerifyInputSchema,
} from '@kawan-pasar/contracts';
import type {
  ForgotInput,
  LoginInput,
  LoginResponse,
  RegisterInput,
  ResetInput,
  VerifyInput,
} from '@kawan-pasar/contracts';
import {
  Body,
  Controller,
  Header,
  Headers,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import type { AuthContext, AuthService, Caller } from './auth.service.js';
import { Auth, CallerInfo, CsrfGuard, SessionGuard } from './session.guard.js';
import { AUTH_SERVICE } from './tokens.js';

const NO_STORE = 'private, no-store';
/** Same body for every outcome that must not reveal whether an address has an account. */
const CHECK_EMAIL = { status: 'check_email' } as const;

@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(AUTH_SERVICE) private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(202)
  @Header('cache-control', NO_STORE)
  async register(
    @Body(new ZodValidationPipe(RegisterInputSchema)) body: RegisterInput,
    @CallerInfo() caller: Caller,
  ): Promise<typeof CHECK_EMAIL> {
    await this.auth.register(body, caller);
    return CHECK_EMAIL;
  }

  @Post('login')
  @HttpCode(200)
  @Header('cache-control', NO_STORE)
  login(
    @Body(new ZodValidationPipe(LoginInputSchema)) body: LoginInput,
    @CallerInfo() caller: Caller,
    @Headers('x-session-token') previous?: string,
  ): Promise<LoginResponse> {
    // The browser's earlier session (if any) ends with this sign-in: no orphan sessions.
    return this.auth.login(body, caller, typeof previous === 'string' ? previous : undefined);
  }

  @Post('logout')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  @UseGuards(SessionGuard, CsrfGuard)
  async logout(@Auth() auth: AuthContext, @CallerInfo() caller: Caller): Promise<void> {
    await this.auth.logout(auth, caller);
  }

  @Post('verify-email')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async verifyEmail(
    @Body(new ZodValidationPipe(VerifyInputSchema)) body: VerifyInput,
    @CallerInfo() caller: Caller,
  ): Promise<void> {
    await this.auth.verifyEmail(body.token, caller);
  }

  @Post('resend-verification')
  @HttpCode(202)
  @Header('cache-control', NO_STORE)
  @UseGuards(SessionGuard, CsrfGuard)
  async resendVerification(@Auth() auth: AuthContext): Promise<typeof CHECK_EMAIL> {
    await this.auth.resendVerification(auth);
    return CHECK_EMAIL;
  }

  @Post('forgot-password')
  @HttpCode(202)
  @Header('cache-control', NO_STORE)
  async forgotPassword(
    @Body(new ZodValidationPipe(ForgotInputSchema)) body: ForgotInput,
    @CallerInfo() caller: Caller,
  ): Promise<typeof CHECK_EMAIL> {
    await this.auth.forgotPassword(body.email, caller);
    return CHECK_EMAIL;
  }

  @Post('reset-password')
  @HttpCode(204)
  @Header('cache-control', NO_STORE)
  async resetPassword(
    @Body(new ZodValidationPipe(ResetInputSchema)) body: ResetInput,
    @CallerInfo() caller: Caller,
  ): Promise<void> {
    await this.auth.resetPassword(body, caller);
  }
}
