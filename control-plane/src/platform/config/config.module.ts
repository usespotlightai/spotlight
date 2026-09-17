import { Module } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { parseEnv } from '@platform/config/env';

@Module({
  providers: [{ provide: ENV, useFactory: parseEnv }],
  exports: [ENV],
})
export class ConfigModule {}
