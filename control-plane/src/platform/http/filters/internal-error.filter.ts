import {
  type ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { loggablePath } from '@platform/http/loggable-path';
import { noteRefusal } from '@platform/http/refusal';
import {
  ERROR_REPORTS,
  type ErrorReportsPort,
} from '@shared-kernel/application/ports/error-reports.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

type LoggableRequest = {
  method?: string;
  url?: string;
  route?: { path?: unknown };
};

@Catch(HttpException)
export class InternalErrorFilter extends BaseExceptionFilter {
  constructor(
    adapterHost: HttpAdapterHost,
    @Inject(LOGGER) private readonly logger: LoggerPort,
    @Inject(ERROR_REPORTS) private readonly reports: ErrorReportsPort,
  ) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: HttpException, host: ArgumentsHost): void {
    if (exception.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.reports.report(exception, { source: 'http' });
      const request = host.switchToHttp().getRequest<LoggableRequest>();

      this.logger.error(
        {
          err: exception,
          context: InternalErrorFilter.name,
          method: request.method,
          url: loggablePath(request),
        },
        'Internal error',
      );
    }

    if (exception.getStatus() < HttpStatus.INTERNAL_SERVER_ERROR) {
      noteRefusal(host.switchToHttp().getResponse(), {
        error: exception.name,
      });
    }

    super.catch(exception, host);
  }
}
