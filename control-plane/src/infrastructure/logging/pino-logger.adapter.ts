import type { LogFields, LoggerPort } from '@application/ports/logger.port';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class PinoLoggerAdapter implements LoggerPort {
  constructor(private readonly logger: PinoLogger) {}

  debug(fields: LogFields, message: string): void {
    this.logger.debug(fields, message);
  }

  info(fields: LogFields, message: string): void {
    this.logger.info(fields, message);
  }

  warn(fields: LogFields, message: string): void {
    this.logger.warn(fields, message);
  }

  error(fields: LogFields, message: string): void {
    this.logger.error(fields, message);
  }
}
