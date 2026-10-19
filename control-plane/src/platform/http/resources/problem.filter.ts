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
import { httpExceptionOf } from '@platform/http/filters/application-error.filter';
import { loggablePath } from '@platform/http/loggable-path';
import { noteRefusal } from '@platform/http/refusal';
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
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
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

const problemOf = (exception: unknown): Problem => {
  if (exception instanceof ProblemException) {
    return exception.problem;
  }

  const http =
    exception instanceof ApplicationError
      ? httpExceptionOf(exception)
      : exception;

  if (http instanceof HttpException) {
    return ProblemException.withStatus(http.getStatus(), http.message).problem;
  }

  return ProblemException.withStatus(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'The server failed with an unexpected error.',
  ).problem;
};

@Catch()
@Injectable()
export class ProblemFilter implements ExceptionFilter {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(LOGGER) private readonly logger: LoggerPort,
    @Inject(ERROR_REPORTS) private readonly reports: ErrorReportsPort,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const problem = problemOf(exception);

    if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      if (!(exception instanceof ApplicationError)) {
        this.reports.report(exception, { source: 'http' });
      }
      const request = http.getRequest<LoggableRequest>();

      this.logger.error(
        {
          err: exception,
          context: ProblemFilter.name,
          method: request.method,
          url: loggablePath(request),
        },
        'Internal error',
      );
    }

    const adapter = this.adapterHost.httpAdapter;
    const response = http.getResponse<unknown>();

    if (problem.status < HttpStatus.INTERNAL_SERVER_ERROR) {
      noteRefusal(response, {
        type: problem.type,
        error: exception instanceof Error ? exception.name : typeof exception,
      });
    }

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
