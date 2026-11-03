// Server-side Outlook fetch for server components: web → core API (service token), never the
// model service directly. Failures only hide the forecast; prices still render.
import 'server-only';

import { connection } from 'next/server';

import { apiGet, newRequestId } from '@/lib/api/client';
import { serverEnv } from '@/lib/env/server';

import { parseOutlook, type Outlook } from './schema';

/** Per request: the forecast is never baked into prerendered HTML. */
export async function getOutlook(slug: string): Promise<Outlook> {
  await connection();
  const result = await apiGet(
    serverEnv(),
    `/v1/outlook/${encodeURIComponent(slug)}`,
    newRequestId(),
  );
  return result.status === 200
    ? parseOutlook(result.body, result.requestId)
    : { kind: 'unavailable', requestId: result.requestId };
}
