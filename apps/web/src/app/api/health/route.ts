export const dynamic = 'force-dynamic';

/** Liveness for the container healthcheck and Traefik. Does not call the API. */
export function GET(): Response {
  return Response.json({ status: 'ok' }, { headers: { 'cache-control': 'no-store' } });
}
