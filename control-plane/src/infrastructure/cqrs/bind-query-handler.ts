import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import {
  Inject,
  Injectable,
  type InjectionToken,
  type Provider,
  type Type,
} from '@nestjs/common';
import { QueryHandler } from '@nestjs/cqrs';

/**
 * Binds a plain application handler to Nest's query bus, so the application
 * layer can do CQRS without importing the framework.
 *
 */
export function bindQueryHandler<TQuery extends object, TResult>(
  query: Type<TQuery>,
  handler: Type<QueryHandlerPort<TQuery, TResult>>,
  inject: InjectionToken[] = [],
): Provider[] {
  @QueryHandler(query)
  @Injectable()
  class BoundQueryHandler {
    constructor(
      @Inject(handler)
      private readonly inner: QueryHandlerPort<TQuery, TResult>,
    ) {}

    execute(received: TQuery): Promise<TResult> {
      return this.inner.execute(received);
    }
  }

  return [
    {
      provide: handler,
      useFactory: (...dependencies: unknown[]) => new handler(...dependencies),
      inject,
    },
    BoundQueryHandler,
  ];
}
