import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { classify } from './all-exceptions.filter.js';
import { AppError } from './app-error.js';

describe('classify', () => {
  it('keeps the code, contract status, and message of an AppError', () => {
    expect(classify(new AppError('FORECAST_UNAVAILABLE', 'Perkiraan belum tersedia.'))).toEqual({
      status: 503,
      code: 'FORECAST_UNAVAILABLE',
      message: 'Perkiraan belum tersedia.',
    });
  });

  it('maps framework exceptions by status without leaking their message', () => {
    expect(classify(new NotFoundException('Cannot GET /secret-path'))).toEqual({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Sumber daya tidak ditemukan.',
    });
  });

  it('maps Fastify errors that only carry statusCode', () => {
    const tooLarge = Object.assign(new Error('Request body is too large'), { statusCode: 413 });
    expect(classify(tooLarge)).toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });

  it('reports an unmapped 4xx as a plain 400', () => {
    expect(classify(new HttpException('Method Not Allowed', 405))).toMatchObject({
      status: 400,
      code: 'INVALID_REQUEST',
    });
    expect(classify(new BadRequestException())).toMatchObject({ status: 400 });
  });

  it.each([
    ['a plain Error', new Error('db password=hunter2')],
    ['a 502 HttpException', new HttpException('Bad Gateway', 502)],
    ['a non-error value', 'boom'],
    ['an out-of-range statusCode', { statusCode: 200 }],
  ])('hides %s behind INTERNAL_ERROR', (_label, exception) => {
    expect(classify(exception)).toEqual({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan pada server.',
    });
  });
});
