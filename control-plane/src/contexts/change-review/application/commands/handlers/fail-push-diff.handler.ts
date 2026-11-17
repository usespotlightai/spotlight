import type { FailPushDiffCommand } from '@change-review/application/commands/fail-push-diff.command';
import type { StackPushes } from '@change-review/application/services/stack-pushes.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class FailPushDiffHandler implements CommandHandlerPort<
  FailPushDiffCommand,
  void
> {
  constructor(private readonly pushes: StackPushes) {}

  async execute(command: FailPushDiffCommand): Promise<void> {
    try {
      await this.pushes.failed(
        command.diffId,
        RunnerId.of(command.runnerId),
        command.reason,
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
