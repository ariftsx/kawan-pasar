import { Controller, Get, Header } from '@nestjs/common';

type ProbeResult = { status: 'ok'; checks: Record<string, 'ok'> };

/**
 * Probes for Docker, Traefik, and Uptime Kuma (docs 13 §A9). `/readyz` gains its DB, Valkey, and
 * model-svc checks (1 s timeout each) once those clients exist in local dev (F0 PR 10).
 */
@Controller()
export class HealthController {
  @Get('healthz')
  @Header('cache-control', 'no-store')
  liveness(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('readyz')
  @Header('cache-control', 'no-store')
  readiness(): ProbeResult {
    return { status: 'ok', checks: {} };
  }
}
