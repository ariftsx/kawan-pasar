import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { ApiError } from '@kawan-pasar/contracts';
import type { FastifyReply } from 'fastify';
import { ApiHttpError } from './api-errors.js';

const GENERIC: Partial<Record<number, ApiError>> = {
  [HttpStatus.NOT_FOUND]: { error: { code: 'not_found', message: 'resource not found' } },
  [HttpStatus.BAD_REQUEST]: { error: { code: 'bad_request', message: 'invalid request' } },
  [HttpStatus.UNAUTHORIZED]: { error: { code: 'unauthorized', message: 'unauthorized' } },
  [HttpStatus.TOO_MANY_REQUESTS]: { error: { code: 'rate_limited', message: 'too many requests' } },
};

const INTERNAL: ApiError = { error: { code: 'internal', message: 'internal error' } };

/**
 * What an unexpected error may write to the log: its kind and, for database errors, the SQLSTATE
 * and driver error kind. Never the message or the stack: a database error message quotes the
 * query parameters (an e-mail address, Fase 2A load test), and the stack repeats the message.
 */
export function describeUnexpected(e: unknown): string {
  if (!(e instanceof Error)) return 'unexpected non-error thrown';
  const cause: unknown = e.cause;
  const parts = [`unexpected ${e.name}`];
  if (cause instanceof Error) {
    parts.push(`cause ${cause.name}`);
    const code: unknown = Reflect.get(cause, 'code');
    if (typeof code === 'string' && /^[A-Z0-9_]{1,32}$/.test(code)) parts.push(`code ${code}`);
  }
  return parts.join(', ');
}

/**
 * Maps every error to the contract shape. Framework messages ("Cannot GET /x"), raw input and
 * stack traces never reach the client; unexpected errors are logged server-side only.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    if (exception instanceof ApiHttpError) {
      if (exception.retryAfterSeconds !== undefined) {
        void reply.header('retry-after', String(exception.retryAfterSeconds));
      }
      void reply.status(exception.getStatus()).send(exception.toBody());
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = GENERIC[status];
      if (body !== undefined) {
        void reply.status(status).send(body);
        return;
      }
      if (status < 500) {
        void reply
          .status(status)
          .send({ error: { code: 'bad_request', message: 'invalid request' } });
        return;
      }
    }

    this.log.error(describeUnexpected(exception));
    void reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send(INTERNAL);
  }
}
