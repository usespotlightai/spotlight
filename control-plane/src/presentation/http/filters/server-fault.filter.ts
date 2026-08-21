import {
  type ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

type LoggableRequest = {
  method?: string;
  url?: string;
};

@Catch(HttpException)
export class ServerFaultFilter extends BaseExceptionFilter {
  constructor(
    adapterHost: HttpAdapterHost,
    @InjectPinoLogger(ServerFaultFilter.name)
    private readonly logger: PinoLogger,
  ) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: HttpException, host: ArgumentsHost): void {
    // 4xx are the client's problem and the access line already records them.
    if (exception.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const request = host.switchToHttp().getRequest<LoggableRequest>();

      this.logger.error(
        { err: exception, method: request.method, url: request.url },
        'Server fault',
      );
    }

    super.catch(exception, host);
  }
}
