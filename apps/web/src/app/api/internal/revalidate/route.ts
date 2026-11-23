import { revalidateTag } from 'next/cache';
import { parseCacheTag } from '@kawan-pasar/contracts';
import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import { log } from '@/lib/log';
import { tokenMatches } from '@/lib/revalidate-auth';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 8 * 1024;

const BodySchema = z.strictObject({
  tags: z
    .array(z.string().max(256))
    .min(1)
    .max(50)
    .transform((tags, ctx) => {
      const parsed = tags.map(parseCacheTag);
      if (parsed.some((t) => t === null)) {
        ctx.addIssue({ code: 'custom', message: 'unknown tag' });
        return z.NEVER;
      }
      return [...new Set(parsed)] as string[];
    }),
});

/**
 * Reads at most `limit` bytes of the body: a declared larger length is refused unread, and a body
 * without (or with a false) length stops being read as soon as it passes the limit. null = too large.
 */
async function readLimited(request: Request, limit: number): Promise<string | null> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > limit) return null;
  if (request.body === null) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const problem = (status: number, code: string): Response =>
  Response.json({ error: { code } }, { status, headers: { 'cache-control': 'no-store' } });

/**
 * Internal: the Core API calls this after data changes (WebRevalidator). Reachable only inside
 * the Docker network; Traefik refuses /api/internal/* from outside.
 */
export async function POST(request: Request): Promise<Response> {
  if (!tokenMatches(request.headers.get('x-revalidate-token'), serverEnv().WEB_REVALIDATE_TOKEN)) {
    return problem(401, 'unauthorized');
  }
  const raw = await readLimited(request, MAX_BODY_BYTES);
  if (raw === null) return problem(413, 'payload_too_large');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return problem(400, 'bad_request');
  }
  const body = BodySchema.safeParse(json);
  if (!body.success) return problem(400, 'bad_request');
  // Data (prices, forecasts) may be served stale once while it refreshes: fast, and never wrong
  // for long. Articles expire at once (Fase 3B): an article withdrawn by an admin must not be
  // shown again, and a newly published one must not stay "not found" for the next visitor.
  for (const tag of body.data.tags) {
    revalidateTag(tag, tag === 'articles' || tag.startsWith('article:') ? { expire: 0 } : 'max');
  }
  log('info', 'revalidated', { tags: body.data.tags.length });
  return new Response(null, { status: 204 });
}
