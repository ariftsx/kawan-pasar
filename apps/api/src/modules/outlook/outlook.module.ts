import { Module } from '@nestjs/common';

import { OutlookController } from './outlook.controller.js';
import { ModelClient } from '../../infra/model-client.js';

@Module({ controllers: [OutlookController], providers: [ModelClient] })
export class OutlookModule {}
