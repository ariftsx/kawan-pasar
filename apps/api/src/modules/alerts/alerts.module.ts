import { Inject, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import { CLOCK } from '../../common/clock.js';
import type { Clock } from '../../common/clock.js';
import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import type { Db } from '../../database/client.js';
import { DRIZZLE } from '../../database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthTokenService } from '../auth/auth-token.service.js';
import { PhoneCipher } from '../auth/phone-cipher.js';
import { UsersRepository } from '../auth/users.repository.js';
import {
  ALERTS_SERVICE,
  AlertsController,
  NotificationsController,
  WeeklyUnsubscribeController,
} from './alerts.controller.js';
import { ALERTS_TRIGGER, BullAlertsTrigger } from './alerts.queue.js';
import type { AlertsTrigger } from './alerts.queue.js';
import { AlertsRepository } from './alerts.repository.js';
import { AlertsService } from './alerts.service.js';

/** Producer side of the alerts queue, for the internal "data changed" endpoint. */
@Module({
  providers: [
    {
      provide: ALERTS_TRIGGER,
      inject: [ENV],
      useFactory: (env: Env): AlertsTrigger => new BullAlertsTrigger(env.VALKEY_QUEUE_URL),
    },
  ],
  exports: [ALERTS_TRIGGER],
})
export class AlertsQueueModule implements OnApplicationShutdown {
  constructor(@Inject(ALERTS_TRIGGER) private readonly trigger: AlertsTrigger) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.trigger instanceof BullAlertsTrigger) await this.trigger.close();
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AlertsController, NotificationsController, WeeklyUnsubscribeController],
  providers: [
    {
      provide: ALERTS_SERVICE,
      inject: [ENV, DRIZZLE, CLOCK],
      useFactory: (env: Env, db: Db, clock: Clock): AlertsService =>
        new AlertsService(
          new AlertsRepository(db),
          new UsersRepository(db, env.AUTH_SECRET, new PhoneCipher(env.PHONE_ENC_KEY)),
          new AuthTokenService(db, clock),
        ),
    },
  ],
})
export class AlertsModule {}
