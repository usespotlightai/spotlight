import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { ProblemException } from '@platform/http/resources/problem.exception';
import { isReplayed } from '@platform/http/resources/replayed';
import {
  API_VERSION,
  API_VERSION_HEADER,
  ETAG_HEADER,
  entityTagOf,
  headerIn,
  IDEMPOTENT_REPLAY_HEADER,
  type RequestHeaders,
  SUPPORTED_API_VERSIONS,
} from '@platform/http/resources/resource-headers';
import { type Observable, tap } from 'rxjs';

interface HeaderedResponse {
  setHeader(name: string, value: string): void;
}

const versionOf = (body: unknown): number | undefined => {
  const version = (body as { version?: unknown } | null)?.version;

  return typeof version === 'number' ? version : undefined;
};

@Injectable()
export class ResourceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const { headers } = http.getRequest<{ headers: RequestHeaders }>();
    const response = http.getResponse<HeaderedResponse>();
    const asked = headerIn(headers, API_VERSION_HEADER);

    response.setHeader(API_VERSION_HEADER, API_VERSION);

    if (asked !== undefined && !SUPPORTED_API_VERSIONS.includes(asked)) {
      throw ProblemException.unsupportedApiVersion(
        asked,
        SUPPORTED_API_VERSIONS,
      );
    }

    return next.handle().pipe(
      tap((body) => {
        const version = versionOf(body);

        if (version !== undefined) {
          response.setHeader(ETAG_HEADER, entityTagOf(version));
        }

        if (isReplayed(body)) {
          response.setHeader(IDEMPOTENT_REPLAY_HEADER, 'true');
        }
      }),
    );
  }
}
