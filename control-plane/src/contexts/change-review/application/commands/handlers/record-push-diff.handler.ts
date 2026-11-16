import type { RecordPushDiffCommand } from '@change-review/application/commands/record-push-diff.command';
import type { StackPushes } from '@change-review/application/services/stack-pushes.service';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RecordPushDiffHandler implements CommandHandlerPort<
  RecordPushDiffCommand,
  void
> {
  constructor(private readonly pushes: StackPushes) {}

  async execute(command: RecordPushDiffCommand): Promise<void> {
    try {
      await this.pushes.diffed(command.diffId, RunnerId.of(command.runnerId), {
        diff: command.diff,
        base: command.base,
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
