import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import { drafted } from '@change-review/application/services/stack-drafting';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import { sessionRunFor } from '@change-review/domain/services/session-run';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export class RedraftChangeStack {
  constructor(
    private readonly stacks: ChangeStackRepository,
    private readonly generator: ChangeStackGeneratorPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async redrafted(
    stack: ChangeStack,
    check: StackCheck | null,
  ): Promise<ChangeStack> {
    const redraft = stack.redraftFor(check);

    if (!check || !redraft) {
      return stack.stopRedrafting();
    }

    const basis = sessionRunFor(
      stack,
      stack.taskId ? await this.stacks.ofTask(stack.taskId) : [],
    );

    if (!basis) {
      this.logger.warn(
        { changeStackId: stack.id.value },
        'No run of the task can host the session redrafting the change stack, so it stays as it is',
      );
      return stack.stopRedrafting();
    }

    const previous = stack.previous
      ? await this.stacks.find(stack.previous)
      : null;

    return drafted(
      this.generator,
      stack,
      {
        workspaceId: stack.workspaceId.value,
        round: stack.redraftingRound(check.id),
        basedOnRun: basis,
        diff: stack.diff,
        repository: stack.repository,
        facts: stack.facts,
        problems: stack.problems,
        redraft,
      },
      (drafting, cohorts) =>
        drafting.redrafted(cohorts, this.clock.now(), { previous }),
      this.clock.now(),
      this.logger,
    );
  }
}
