import { LOGGER, type LoggerPort } from '@application/ports/logger.port';
import {
  type ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';

type LoggableRequest = {
  method?: string;
  url?: string;
};

@Catch(HttpException)
export class ServerFaultFilter extends BaseExceptionFilter {
  constructor(
    adapterHost: HttpAdapterHost,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: HttpException, host: ArgumentsHost): void {
    if (exception.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const request = host.switchToHttp().getRequest<LoggableRequest>();

      this.logger.error(
        {
          err: exception,
          context: ServerFaultFilter.name,
          method: request.method,
          url: request.url,
        },
        'Server fault',
      );
    }

    super.catch(exception, host);
  }
}
