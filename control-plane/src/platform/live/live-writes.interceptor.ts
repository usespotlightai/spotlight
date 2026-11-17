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
        const header = await LiveWrites.headerOf(published);

        if (header && !response.headersSent) {
          response.setHeader(LIVE_SEQUENCES_HEADER, header);
        }

        return body;
      }),
    );
  }
}

const WRITES_INTERCEPTOR = new LiveWritesInterceptor();

export const interceptWrites = (app: INestApplication): void => {
  const scanner = app.get(MetadataScanner);

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
      const interceptors =
        (Reflect.getMetadata(INTERCEPTORS_METADATA, handler) as
          | unknown[]
          | undefined) ?? [];

      if (
        Reflect.getMetadata(PATH_METADATA, handler) === undefined ||
        !WRITES.has(method as RequestMethod) ||
        interceptors.includes(WRITES_INTERCEPTOR)
      ) {
        continue;
      }

      Reflect.defineMetadata(
        INTERCEPTORS_METADATA,
        [WRITES_INTERCEPTOR, ...interceptors],
        handler,
      );
    }
  }
};
