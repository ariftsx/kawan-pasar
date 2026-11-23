import { ExportQuerySchema, TokenSchema } from '@kawan-pasar/contracts';
import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/cookie';
import { serverEnv } from '@/lib/env';
import { accountHrefs } from '@/lib/hrefs';
import { log } from '@/lib/log';

export const dynamic = 'force-dynamic';

/** Public file name → Core API export. */
const FILES = {
  'harga.csv': '/v1/analyst/export/prices.csv',
  'prediksi.csv': '/v1/analyst/export/forecasts.csv',
} as const;

const plain = (status: number, body: string, extra: Record<string, string> = {}): Response =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });

// Relative Location (RFC 9110): behind Traefik the server's own origin is internal.
const redirectTo = (path: string): Response =>
  new Response(null, { status: 303, headers: { location: path, 'cache-control': 'no-store' } });

/**
 * CSV downloads of Mode Analis (Fase 3A). The session cookie stays in the BFF: the API gets the
 * token, the visitor gets the file. Only the validated filter is forwarded.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await params;
  const target = Object.hasOwn(FILES, file) ? FILES[file as keyof typeof FILES] : undefined;
  if (target === undefined) return plain(404, 'Berkas tidak ditemukan.');

  // Each download counts against a limit: another site may not spend it (cookie is SameSite=Lax).
  // Browsers send same-origin (form on /analis) or none (typed URL); a sibling subdomain sends
  // same-site. Clients without the header (curl with a copied cookie) are not a CSRF vector.
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site' || site === 'same-site') {
    return plain(403, 'Unduhan hanya dari halaman Mode Analis.');
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token === undefined || !TokenSchema.safeParse(token).success) {
    return redirectTo(accountHrefs.signIn('/analis'));
  }

  const sp = request.nextUrl.searchParams;
  const raw = {
    ...(sp.getAll('komoditas').length > 0 ? { commodities: sp.getAll('komoditas').join(',') } : {}),
    ...(sp.get('dari') ? { from: sp.get('dari') } : {}),
    ...(sp.get('sampai') ? { to: sp.get('sampai') } : {}),
  };
  const q = ExportQuerySchema.safeParse(raw);
  if (!q.success) return plain(400, 'Pilihan unduhan tidak valid. Periksa komoditas dan tanggal.');
  const query = new URLSearchParams();
  if (q.data.commodities !== undefined) query.set('commodities', q.data.commodities.join(','));
  if (q.data.from !== undefined) query.set('from', q.data.from);
  if (q.data.to !== undefined) query.set('to', q.data.to);

  const env = serverEnv();
  const incoming = await headers();
  const forwardedFor = (incoming.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? '';
  let res: Response;
  try {
    res = await fetch(new URL(`${target}?${query.toString()}`, env.API_INTERNAL_URL), {
      headers: {
        'x-service-token': env.SERVICE_TOKEN,
        'x-session-token': token,
        'x-forwarded-for': forwardedFor === '' ? '0.0.0.0' : forwardedFor,
        'user-agent': (incoming.get('user-agent') ?? '').slice(0, 400),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    log('warn', 'analyst export failed', { reason: e instanceof Error ? e.name : 'unknown' });
    return plain(503, 'Layanan sedang tidak tersedia. Coba lagi sebentar lagi.');
  }

  if (res.status === 401) return redirectTo(accountHrefs.signIn('/analis'));
  if (res.status === 403) return redirectTo(accountHrefs.analyst());
  if (res.status === 429) {
    const seconds = Number(res.headers.get('retry-after'));
    const retry = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 3600;
    const minutes = Math.max(1, Math.ceil(retry / 60));
    return plain(
      429,
      `Batas 30 unduhan per jam tercapai. Coba lagi dalam ${String(minutes)} menit.`,
      {
        'retry-after': String(retry),
      },
    );
  }
  if (!res.ok || res.body === null) {
    return plain(503, 'Layanan sedang tidak tersedia. Coba lagi sebentar lagi.');
  }
  return new Response(res.body, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
