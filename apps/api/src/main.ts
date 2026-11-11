import { createApp } from './app.factory.js';
import { EnvValidationError, loadEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  const env = loadEnv(process.env);
  const app = await createApp(env);
  await app.listen({ port: env.API_PORT, host: '0.0.0.0' });
}

bootstrap().catch((e: unknown) => {
  // Before the logger exists the only safe output is the variable names / error class.
  const message = e instanceof EnvValidationError ? e.message : 'api failed to start';
  process.stderr.write(`${message}\n`);
  if (!(e instanceof EnvValidationError) && e instanceof Error) {
    process.stderr.write(`${e.name}: ${e.message}\n`);
  }
  process.exit(1);
});
