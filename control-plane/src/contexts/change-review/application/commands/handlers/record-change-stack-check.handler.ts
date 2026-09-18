import type { RecordChangeStackCheckCommand } from '@change-review/application/commands/record-change-stack-check.command';
import { checkedStepsFrom } from '@change-review/application/mappers/change-stack.from-dto';
import type { WorkPort } from '@change-review/application/ports/work.port';
import { UnknownChangeStackError } from '@change-review/domain/exceptions/unknown-change-stack.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RecordChangeStackCheckHandler
  implements CommandHandlerPort<RecordChangeStackCheckCommand, void>
{
  constructor(
    private readonly work: WorkPort,
    private readonly stacks: ChangeStackRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RecordChangeStackCheckCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);

      if (
        !(await this.work.wasWorkedBy(runId, RunnerId.of(command.runnerId)))
      ) {
        throw new UnknownChangeStackError(
          `there is no run ${command.runId} this runner worked`,
        );
      }

      const stack = await this.stacks.find(ChangeStackId.of(command.stackId));

      if (!stack?.runId.equals(runId)) {
        throw new UnknownChangeStackError(
          `run ${command.runId} drafted no change stack ${command.stackId}`,
        );
      }

      const now = this.clock.now();

      const checked = command.skipped
        ? stack.skipCheck(command.skipped, now)
        : stack.recordCheck(checkedStepsFrom(command.steps), now);

      await this.stacks.save(checked);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
