import { Module } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { ConfigModule } from '@platform/config/config.module';
import { buildLogging, type Logging } from '@platform/logging/logger.config';
import { LOGGING } from '@platform/logging/logging.constants';
import { PinoLoggerAdapter } from '@platform/logging/pino-logger.adapter';
import { LOGGER } from '@shared-kernel/application/ports/logger.port';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [ConfigModule],
  providers: [{ provide: LOGGING, useFactory: buildLogging, inject: [ENV] }],
  exports: [LOGGING],
})
class LoggingSetupModule {}

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
