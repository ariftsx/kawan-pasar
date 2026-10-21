// Every failure leaves as the error envelope (docs 08 §8). Stacks go to the log, never the body.
import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';

import { AppError } from './app-error.js';
import { resolveRequestId } from './request-id.js';

import type { ErrorCode } from '@kawan-pasar/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Framework and Fastify errors only carry an HTTP status; map it to the closest contract code. */
const BY_STATUS: ReadonlyMap<number, { code: ErrorCode; message: string }> = new Map([
  [401, { code: 'UNAUTHENTICATED', message: 'Autentikasi diperlukan.' }],
  [403, { code: 'FORBIDDEN', message: 'Akses ditolak.' }],
  [404, { code: 'NOT_FOUND', message: 'Sumber daya tidak ditemukan.' }],
  [413, { code: 'PAYLOAD_TOO_LARGE', message: 'Ukuran permintaan terlalu besar.' }],
  [415, { code: 'INVALID_REQUEST', message: 'Jenis konten tidak didukung.' }],
  [429, { code: 'RATE_LIMITED', message: 'Terlalu banyak permintaan. Coba lagi nanti.' }],
]);

const BAD_REQUEST = { code: 'INVALID_REQUEST', message: 'Permintaan tidak valid.' } as const;
const INTERNAL = { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server.' } as const;

type Classified = { status: number; code: ErrorCode; message: string };

function statusOf(exception: unknown): number | undefined {
  if (exception instanceof HttpException) return exception.getStatus();
  if (typeof exception === 'object' && exception !== null && 'statusCode' in exception) {
    const { statusCode } = exception;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600) return statusCode;
  }
  return undefined;
}

export function classify(exception: unknown): Classified {
  if (exception instanceof AppError) {
    return { status: exception.status, code: exception.code, message: exception.message };
  }
  const status = statusOf(exception);
  if (status === undefined || status >= 500) return { status: 500, ...INTERNAL };
  // Each contract code has exactly one status, so an unmapped 4xx is reported as a plain 400.
  const known = BY_STATUS.get(status);
  return known === undefined ? { status: 400, ...BAD_REQUEST } : { status, ...known };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();
    const { status, code, message } = classify(exception);
    const requestId = resolveRequestId(request.raw);

    if (status >= 500) this.logger.error({ err: exception, request_id: requestId }, code);
    else this.logger.warn({ request_id: requestId, code }, 'request rejected');

    void reply
      .status(status)
      .header('cache-control', 'no-store')
      .send({ data: null, error: { code, message, request_id: requestId } });
  }
}
