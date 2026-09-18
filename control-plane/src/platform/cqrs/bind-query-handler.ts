import {
  Inject,
  Injectable,
  type InjectionToken,
  type Provider,
  type Type,
} from '@nestjs/common';
import { QueryHandler } from '@nestjs/cqrs';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

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
