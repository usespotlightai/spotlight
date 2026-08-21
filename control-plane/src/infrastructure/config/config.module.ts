import { ENV } from '@infrastructure/config/config.constants';
import { parseEnv } from '@infrastructure/config/env';
import { Module } from '@nestjs/common';

@Module({
  providers: [{ provide: ENV, useFactory: parseEnv }],
  exports: [ENV],
})
export class ConfigModule {}
