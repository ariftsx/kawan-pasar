import { HttpException, HttpStatus } from '@nestjs/common';
import type { ApiError, ApiErrorCode } from '@kawan-pasar/contracts';

/** Errors the API raises on purpose; everything else becomes a generic 500. */
export class ApiHttpError extends HttpException {
  readonly code: ApiErrorCode;
  readonly fields: readonly string[] | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    status: HttpStatus,
    code: ApiErrorCode,
    message: string,
    extra: { fields?: readonly string[]; retryAfterSeconds?: number } = {},
  ) {
    super(message, status);
    this.code = code;
    this.fields = extra.fields;
    this.retryAfterSeconds = extra.retryAfterSeconds;
  }

  toBody(): ApiError {
    const fields = this.fields === undefined ? {} : { fields: [...this.fields] };
    return { error: { code: this.code, message: this.message, ...fields } };
  }
}

export const badRequest = (fields: readonly string[]): ApiHttpError =>
  new ApiHttpError(HttpStatus.BAD_REQUEST, 'bad_request', 'invalid request', { fields });

export const notFound = (): ApiHttpError =>
  new ApiHttpError(HttpStatus.NOT_FOUND, 'not_found', 'resource not found');

export const unauthorized = (): ApiHttpError =>
  new ApiHttpError(HttpStatus.UNAUTHORIZED, 'unauthorized', 'unauthorized');

export const rateLimited = (retryAfterSeconds: number): ApiHttpError =>
  new ApiHttpError(HttpStatus.TOO_MANY_REQUESTS, 'rate_limited', 'too many requests', {
    retryAfterSeconds,
  });

// --- accounts (Fase 2A): generic messages, never the reason a lookup failed ---

export const unauthenticated = (): ApiHttpError =>
  new ApiHttpError(HttpStatus.UNAUTHORIZED, 'unauthenticated', 'sign-in required');

export const invalidCredentials = (): ApiHttpError =>
  new ApiHttpError(HttpStatus.UNAUTHORIZED, 'invalid_credentials', 'invalid credentials');

export const locked = (retryAfterSeconds: number): ApiHttpError =>
  new ApiHttpError(HttpStatus.TOO_MANY_REQUESTS, 'locked', 'temporarily locked', {
    retryAfterSeconds,
  });

/** `problem` is the policy rule (too_short, too_long, breached, same_as_email), not the input. */
export const weakPassword = (problem: string, field = 'password'): ApiHttpError =>
  new ApiHttpError(HttpStatus.UNPROCESSABLE_ENTITY, 'weak_password', problem, { fields: [field] });

export const invalidToken = (): ApiHttpError =>
  new ApiHttpError(HttpStatus.BAD_REQUEST, 'invalid_token', 'invalid or expired link');

export const csrfRejected = (): ApiHttpError =>
  new ApiHttpError(HttpStatus.FORBIDDEN, 'csrf', 'invalid request origin');

export const conflict = (field: string): ApiHttpError =>
  new ApiHttpError(HttpStatus.CONFLICT, 'conflict', 'conflict', { fields: [field] });
