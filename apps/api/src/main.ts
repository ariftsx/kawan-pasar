import { createApp } from './app.factory.js';
import { parseEnv } from './config/env.js';

const env = parseEnv(process.env);
const app = await createApp(env);
await app.listen({ host: env.HOST, port: env.PORT });
