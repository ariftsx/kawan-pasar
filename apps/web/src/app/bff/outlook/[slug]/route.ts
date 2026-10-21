// BFF for Outlook (docs 12 §5). It only forwards to the core API; rules live in apps/api.
import { NextResponse, type NextRequest } from 'next/server';

import { apiGet, newRequestId } from '@/lib/api/client';
import { serverEnv } from '@/lib/env/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const horizon = request.nextUrl.searchParams.get('horizon');
  const query = horizon === null ? '' : `?horizon=${encodeURIComponent(horizon)}`;
  const result = await apiGet(
    serverEnv(),
    `/v1/outlook/${encodeURIComponent(slug)}${query}`,
    newRequestId(),
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { 'cache-control': 'no-store', 'x-request-id': result.requestId },
  });
}
