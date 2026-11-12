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
  const raw = await request.text();
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) return problem(413, 'payload_too_large');
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return problem(400, 'bad_request');
  }
  const body = BodySchema.safeParse(json);
  if (!body.success) return problem(400, 'bad_request');
  for (const tag of body.data.tags) revalidateTag(tag, 'max');
  log('info', 'revalidated', { tags: body.data.tags.length });
  return new Response(null, { status: 204 });
}
