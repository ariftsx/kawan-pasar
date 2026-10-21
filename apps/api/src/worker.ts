// BullMQ worker entrypoint: same image as the API, different CMD (docs 13 §A2). Queues and
// processors (alerts.evaluate, artifacts.sync, …) register here as their modules land.
import 'reflect-metadata';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger, LoggerModule } from 'nestjs-pino';

import { ConfigModule } from './config/config.module.js';
import { parseEnv } from './config/env.js';

const env = parseEnv(process.env);

@Module({
  imports: [
    ConfigModule.forRoot(env),
    LoggerModule.forRoot({ pinoHttp: { level: env.LOG_LEVEL } }),
  ],
})
class WorkerModule {}

const worker = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
worker.useLogger(worker.get(Logger));
worker.enableShutdownHooks();
worker.get(Logger).log('worker ready (no queues registered yet)');

// No queue holds the event loop open yet; this timer does until SIGTERM/SIGINT closes the context.
setInterval(() => undefined, 2 ** 30);
