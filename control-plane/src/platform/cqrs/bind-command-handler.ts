import {
  Inject,
  Injectable,
  type InjectionToken,
  type Provider,
  type Type,
} from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export function bindCommandHandler<TCommand extends object, TResult>(
  command: Type<TCommand>,
  handler: Type<CommandHandlerPort<TCommand, TResult>>,
  inject: InjectionToken[] = [],
): Provider[] {
  @CommandHandler(command)
  @Injectable()
  class BoundCommandHandler {
    constructor(
      @Inject(handler)
      private readonly inner: CommandHandlerPort<TCommand, TResult>,
    ) {}

    execute(received: TCommand): Promise<TResult> {
      return this.inner.execute(received);
    }
  }

  return [
    {
      provide: handler,
      useFactory: (...dependencies: unknown[]) => new handler(...dependencies),
      inject,
    },
    BoundCommandHandler,
  ];
}
