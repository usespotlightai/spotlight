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
import { ForbiddenActs } from '@platform/http/resources/forbidden-acts';
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
import { connectionsExhausted } from '@platform/persistence/drizzle/violations';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import {
  ERROR_REPORTS,
  type ErrorReportsPort,
} from '@shared-kernel/application/ports/error-reports.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';

const SERVER_ERROR: number = HttpStatus.INTERNAL_SERVER_ERROR;

const RETRY_AFTER_SECONDS = '5';

const CONNECTIONS_REFUSED_METRIC = 'spotlight_db_connection_refused_total';

class DatabaseConnectionsExhausted extends Error {
  constructor(readonly cause: unknown) {
    super('The database refused a connection');
  }
}

type LoggableRequest = {
  method?: string;
  url?: string;
  route?: { path?: unknown };
};

const problemOf = (exception: unknown): Problem => {
  if (exception instanceof ProblemException) {
    return exception.problem;
  }

  if (connectionsExhausted(exception)) {
    return ProblemException.withStatus(
      HttpStatus.SERVICE_UNAVAILABLE,
      'The service is busy. Please retry shortly.',
    ).problem;
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
    @Inject(TELEMETRY) private readonly telemetry: TelemetryPort,
    private readonly forbiddenActs: ForbiddenActs,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const problem = this.explained(exception, problemOf(exception));

    const refused = connectionsExhausted(exception);

    if (refused) {
      this.telemetry.count(CONNECTIONS_REFUSED_METRIC);
      this.reports.report(new DatabaseConnectionsExhausted(exception), {
        source: 'db.pool_exhausted',
      });
      this.logger.error(
        { err: exception, context: ProblemFilter.name },
        'Refused a database connection',
      );
    } else if (problem.status >= SERVER_ERROR) {
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

    if (problem.status < SERVER_ERROR) {
      noteRefusal(response, {
        type: problem.type,
        error: exception instanceof Error ? exception.name : typeof exception,
      });
    }

    adapter.setHeader(response, 'Content-Type', PROBLEM_CONTENT_TYPE);
    adapter.setHeader(response, API_VERSION_HEADER, API_VERSION);

    if (refused) {
      adapter.setHeader(response, 'Retry-After', RETRY_AFTER_SECONDS);
    }

    if (problem.currentVersion !== undefined) {
      adapter.setHeader(
        response,
        ETAG_HEADER,
        entityTagOf(problem.currentVersion),
      );
    }

    adapter.reply(response, problem, problem.status);
  }

  private explained(exception: unknown, problem: Problem): Problem {
    const forbidden =
      exception instanceof ProblemException ? exception.forbiddenRequest : null;
    const text = forbidden
      ? this.forbiddenActs.textOf(forbidden.act, forbidden.kind)
      : null;

    return text ? { ...problem, title: text[0], detail: text[1] } : problem;
  }
}
