// X-Request-Id is carried web → api → model-svc and echoed back (docs 08 §2).
import { ulid } from 'ulid';

import type { IncomingMessage } from 'node:http';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Accept an upstream id only if it is short and log-safe; otherwise mint our own. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{1,64}$/;

const assigned = new WeakMap<IncomingMessage, string>();

/**
 * Fastify and pino-http each ask for an id for the same raw request; memoising per request keeps
 * the id in the log line, the response header, and the error body identical.
 */
export function resolveRequestId(request: IncomingMessage): string {
  const existing = assigned.get(request);
  if (existing !== undefined) return existing;
  const incoming = request.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : `req_${ulid()}`;
  assigned.set(request, id);
  return id;
}
