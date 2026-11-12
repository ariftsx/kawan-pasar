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
