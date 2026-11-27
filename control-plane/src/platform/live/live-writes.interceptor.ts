import {
  type CallHandler,
  type ExecutionContext,
  type INestApplication,
  Injectable,
  type NestInterceptor,
  RequestMethod,
} from '@nestjs/common';
import {
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
} from '@nestjs/common/constants';
import { controllerMethodsOf } from '@platform/http/controller-routes';
import type { SequencedNotice } from '@platform/live/change-notices';
import { LIVE_SEQUENCES_HEADER, LiveWrites } from '@platform/live/live-writes';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import type { Response } from 'express';
import { mergeMap, Observable } from 'rxjs';

const WRITES = new Set<RequestMethod>([
  RequestMethod.POST,
  RequestMethod.PUT,
  RequestMethod.PATCH,
  RequestMethod.DELETE,
]);

@Injectable()
class LiveWritesInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerPort) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const published: Promise<readonly SequencedNotice[]>[] = [];
    const response = http.getResponse<Response>();

    return new Observable<unknown>((subscriber) =>
      LiveWrites.within(published, () => next.handle().subscribe(subscriber)),
    ).pipe(
      mergeMap(async (body) => {
        const header = await LiveWrites.headerOf(published, () =>
          this.logger.warn(
            { method: http.getRequest<{ method: string }>().method },
            'Live sequences were late for a write response',
          ),
        );

        if (nonEmpty(header) && !response.headersSent) {
          response.setHeader(LIVE_SEQUENCES_HEADER, header);
        }

        return body;
      }),
    );
  }
}

export const interceptWrites = (app: INestApplication): void => {
  const interceptor = new LiveWritesInterceptor(app.get<LoggerPort>(LOGGER));

  for (const { handler } of controllerMethodsOf(app)) {
    const method: unknown = Reflect.getMetadata(METHOD_METADATA, handler);

    if (typeof method !== 'number' || !WRITES.has(method)) {
      continue;
    }

    const existing: unknown = Reflect.getMetadata(
      INTERCEPTORS_METADATA,
      handler,
    );
    const interceptors: readonly unknown[] = Array.isArray(existing)
      ? existing
      : [];

    Reflect.defineMetadata(
      INTERCEPTORS_METADATA,
      [
        interceptor,
        ...interceptors.filter(
          (each) => !(each instanceof LiveWritesInterceptor),
        ),
      ],
      handler,
    );
  }
};
