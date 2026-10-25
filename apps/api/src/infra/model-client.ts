// HTTP client for the internal model service (docs 08 §7, docs 13 Part C).
import { createHash, createHmac } from 'node:crypto';

import { ErrorCode } from '@kawan-pasar/contracts';
import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';

import { AppError } from '../common/app-error.js';
import { ENV } from '../config/config.module.js';

import type { Env } from '../config/env.js';

/** docs 13 Part C: reading artefacts gets 1 s; one retry for reads happens in the caller. */
const READ_TIMEOUT_MS = 1000;

/** Same canonical string as services/model app/core/security.py; both sides must agree. */
export function signModelRequest(
  secret: string,
  timestamp: string,
  method: string,
  target: string,
  body: string,
): string {
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const canonical = `${timestamp}\n${method.toUpperCase()}\n${target}\n${bodyHash}`;
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

/** The model's error envelope (docs 08 §8). */
const ModelError = z.object({ error: z.object({ code: ErrorCode, message: z.string().min(1) }) });

/**
 * Model errors with a contract code pass through. A rejected signature is our own misconfiguration,
 * so it surfaces as MODEL_UNAVAILABLE like any other failure, never as the caller's 401.
 */
async function toAppError(response: Response): Promise<AppError> {
  const parsed = ModelError.safeParse(await response.json().catch(() => null));
  if (parsed.success && parsed.data.error.code !== 'UNAUTHENTICATED') {
    return new AppError(parsed.data.error.code, parsed.data.error.message);
  }
  return new AppError('MODEL_UNAVAILABLE', 'Layanan perkiraan sedang tidak tersedia.');
}

@Injectable()
export class ModelClient {
  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Signed GET of `target` (path + query); returns the parsed JSON body. */
  async get(target: string, requestId: string): Promise<unknown> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = signModelRequest(this.env.MODEL_HMAC_SECRET, timestamp, 'GET', target, '');
    let response: Response;
    try {
      response = await fetch(new URL(target, this.env.MODEL_URL), {
        headers: {
          'x-kp-timestamp': timestamp,
          'x-kp-signature': signature,
          'x-request-id': requestId,
        },
        signal: AbortSignal.timeout(READ_TIMEOUT_MS),
      });
    } catch {
      throw new AppError('MODEL_UNAVAILABLE', 'Layanan perkiraan sedang tidak tersedia.');
    }
    if (!response.ok) throw await toAppError(response);
    return response.json();
  }
}
