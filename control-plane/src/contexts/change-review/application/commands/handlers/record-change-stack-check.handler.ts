import type { RecordChangeStackCheckCommand } from '@change-review/application/commands/record-change-stack-check.command';
import { checkedStepsFrom } from '@change-review/application/mappers/change-stack.from-dto';
import { UnknownChangeStackError } from '@change-review/domain/exceptions/unknown-change-stack.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { skipOf } from '@change-review/domain/value-objects/stack-check.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RecordChangeStackCheckHandler
  implements CommandHandlerPort<RecordChangeStackCheckCommand, void>
{
  constructor(
    private readonly checks: StackCheckRepository,
    private readonly stacks: ChangeStackRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: RecordChangeStackCheckCommand): Promise<void> {
    try {
      const runId = RunId.of(command.runId);
      const stackId = ChangeStackId.of(command.stackId);
      const check = await this.checks.find(stackId);

      if (!check?.runId.equals(runId)) {
        throw new UnknownChangeStackError(
          `run ${command.runId} drafted no change stack ${command.stackId}`,
        );
      }

      const now = this.clock.now();

      if (!check.claim.heldBy(RunnerId.of(command.runnerId), now)) {
        throw new UnknownChangeStackError(
          `change stack ${command.stackId} is not being checked by this runner`,
        );
      }

      if (command.skipped) {
        await this.checks.save(
          check.skipped(
            skipOf(command.skipped.code, command.skipped.detail),
            now,
          ),
        );
        return;
      }

      const stack = await this.stacks.find(stackId);

      if (!stack) {
        throw new UnknownChangeStackError(
          `there is no change stack ${command.stackId}`,
        );
      }

      await this.checks.save(
        check.recorded(
          {
            steps: stack.checkSteps(check.entries),
            layers: stack.layers(),
          },
          checkedStepsFrom(command.steps),
          now,
        ),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
