import { LOGGER } from '@application/ports/logger.port';
import { ENV } from '@infrastructure/config/config.constants';
import { ConfigModule } from '@infrastructure/config/config.module';
import {
  buildLogging,
  type Logging,
} from '@infrastructure/logging/logger.config';
import { LOGGING } from '@infrastructure/logging/logging.constants';
import { PinoLoggerAdapter } from '@infrastructure/logging/pino-logger.adapter';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [ConfigModule],
  providers: [{ provide: LOGGING, useFactory: buildLogging, inject: [ENV] }],
  exports: [LOGGING],
})
export class LoggingSetupModule {}

@Module({
  imports: [
    LoggingSetupModule,
    LoggerModule.forRootAsync({
      imports: [LoggingSetupModule],
      inject: [LOGGING],
      useFactory: (logging: Logging) => logging.params,
    }),
  ],
  providers: [{ provide: LOGGER, useClass: PinoLoggerAdapter }],
  exports: [LOGGER, LoggingSetupModule, LoggerModule],
})
export class LoggingModule {}
