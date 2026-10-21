import { connection } from 'next/server';

// Liveness for Docker/Traefik/Uptime Kuma (docs 12 §11). Rendered per request, never prerendered.
export async function GET(): Promise<Response> {
  await connection();
  return Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
}
