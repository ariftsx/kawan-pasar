// Container health check of the worker (no HTTP port): healthy while the heartbeat is fresh.
import { HEARTBEAT_FILE, HEARTBEAT_MAX_AGE_MS, isAlive } from './heartbeat.js';

process.exit(isAlive(HEARTBEAT_FILE, HEARTBEAT_MAX_AGE_MS) ? 0 : 1);
