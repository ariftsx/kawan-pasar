import { Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { CLOCK } from '../../common/clock.js';
import type { Clock } from '../../common/clock.js';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import type { Db } from '../../database/client.js';
import { DRIZZLE } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { phoneCipherFromEnv } from '../auth/phone-cipher.js';
import { UsersRepository, undecryptablePhone } from '../auth/users.repository.js';
import {
  WHATSAPP_SERVICE,
  WhatsAppController,
  WhatsAppInboundController,
} from './whatsapp.controller.js';
import { BullWhatsAppOutbox, WHATSAPP_OUTBOX } from './whatsapp.queue.js';
import type { WhatsAppOutbox } from './whatsapp.queue.js';
import { WhatsAppRepository } from './whatsapp.repository.js';
import { WhatsAppService } from './whatsapp.service.js';

@Module({
  imports: [AuthModule],
  controllers: [WhatsAppController, WhatsAppInboundController],
  providers: [
    {
      provide: WHATSAPP_OUTBOX,
      inject: [ENV],
      useFactory: (env: Env): WhatsAppOutbox => new BullWhatsAppOutbox(env.VALKEY_QUEUE_URL),
    },
    {
      provide: WHATSAPP_SERVICE,
      inject: [ENV, DRIZZLE, CLOCK, WHATSAPP_OUTBOX],
      useFactory: (env: Env, db: Db, clock: Clock, outbox: WhatsAppOutbox): WhatsAppService => {
        const phones = phoneCipherFromEnv(env);
        return new WhatsAppService(
          new WhatsAppRepository(db),
          new UsersRepository(db, env.AUTH_SECRET, phones, undecryptablePhone),
          phones,
          outbox,
          env.AUTH_SECRET,
          clock,
        );
      },
    },
  ],
})
export class WhatsAppModule implements OnApplicationShutdown {
  constructor(@Inject(WHATSAPP_OUTBOX) private readonly outbox: WhatsAppOutbox) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.outbox instanceof BullWhatsAppOutbox) await this.outbox.close();
  }
}
