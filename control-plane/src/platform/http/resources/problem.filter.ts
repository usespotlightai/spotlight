import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { httpExceptionOf } from '@platform/http/filters/use-case-fault.filter';
import {
  type Problem,
  ProblemException,
} from '@platform/http/resources/problem.exception';
import {
  API_VERSION,
  API_VERSION_HEADER,
  ETAG_HEADER,
  entityTagOf,
  PROBLEM_CONTENT_TYPE,
} from '@platform/http/resources/resource-headers';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

type LoggableRequest = {
  method?: string;
  url?: string;
};

const problemOf = (exception: unknown): Problem => {
  if (exception instanceof ProblemException) {
    return exception.problem;
  }

  const http =
    exception instanceof UseCaseFault ? httpExceptionOf(exception) : exception;

  if (http instanceof HttpException) {
    return ProblemException.withStatus(http.getStatus(), http.message).problem;
  }

  return ProblemException.withStatus(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'The request could not be completed',
  ).problem;
};

@Catch()
@Injectable()
export class ProblemFilter implements ExceptionFilter {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const problem = problemOf(exception);

    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const request = http.getRequest<LoggableRequest>();

      this.logger.error(
        {
          err: exception,
          context: ProblemFilter.name,
          method: request.method,
          url: request.url,
        },
        'Server fault',
      );
    }

    const adapter = this.adapterHost.httpAdapter;
    const response = http.getResponse<unknown>();

    adapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
    adapter.setHeader(response, API_VERSION_HEADER, API_VERSION);

    if (problem.currentVersion !== undefined) {
      adapter.setHeader(
        response,
        ETAG_HEADER,
        entityTagOf(problem.currentVersion),
      );
    }

    adapter.reply(response, problem, problem.status);
  }
}
