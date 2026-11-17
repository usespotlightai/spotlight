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
  PATH_METADATA,
} from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import type { SequencedNotice } from '@platform/live/change-notices';
import { LIVE_SEQUENCES_HEADER, LiveWrites } from '@platform/live/live-writes';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
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

        if (header && !response.headersSent) {
          response.setHeader(LIVE_SEQUENCES_HEADER, header);
        }

        return body;
      }),
    );
  }
}

export const interceptWrites = (app: INestApplication): void => {
  const scanner = app.get(MetadataScanner);
  const interceptor = new LiveWritesInterceptor(app.get<LoggerPort>(LOGGER));

  for (const { metatype } of app.get(DiscoveryService).getControllers()) {
    const prototype = (metatype as { prototype?: object } | null)?.prototype as
      | Record<string, object>
      | undefined;

    if (!prototype) {
      continue;
    }

    for (const name of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[name];
      const method: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
      const interceptors = (
        (Reflect.getMetadata(INTERCEPTORS_METADATA, handler) as
          | unknown[]
          | undefined) ?? []
      ).filter((each) => !(each instanceof LiveWritesInterceptor));

      if (
        Reflect.getMetadata(PATH_METADATA, handler) === undefined ||
        !WRITES.has(method as RequestMethod)
      ) {
        continue;
      }

      Reflect.defineMetadata(
        INTERCEPTORS_METADATA,
        [interceptor, ...interceptors],
        handler,
      );
    }
  }
};
