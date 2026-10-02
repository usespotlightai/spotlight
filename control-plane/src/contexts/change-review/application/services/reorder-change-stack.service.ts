import type { ChangeStackDrafterPort } from '@change-review/application/ports/change-stack-drafter.port';
import { attemptDrafting } from '@change-review/application/services/drafting-attempt';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import {
  InvalidChangeStackError,
  type StackProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import { revisionOf } from '@change-review/domain/services/stack-revision';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const ATTEMPTS = 2;

export class ReorderChangeStack {
  constructor(
    private readonly drafter: ChangeStackDrafterPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async reordered(stack: ChangeStack, check: StackCheck): Promise<ChangeStack> {
    if (check.failedLayers().length === 0) {
      return stack.gaveUpReordering();
    }

    const { diff, facts } = stack;
    let problems: readonly StackProblem[] = [];
    let reordering = stack;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      const attempt = await attemptDrafting(this.drafter, {
        diff,
        repository: stack.repository,
        facts,
        problems,
        reordering: revisionOf(stack, check),
      });

      if (!attempt.drafted) {
        this.logger.error(
          { changeStackId: stack.id.value, error: attempt.error },
          'Reordering a change stack failed; trying again later',
        );
        return reordering
          .usedModel(attempt.usage)
          .triedAgainLater(this.clock.now());
      }

      const { cohorts, usage } = attempt.answer;
      reordering = reordering.usedModel(usage);

      try {
        return reordering.reordered(cohorts, this.clock.now());
      } catch (error) {
        if (!(error instanceof InvalidChangeStackError)) {
          throw error;
        }
        problems = error.problems;
      }
    }

    this.logger.warn(
      {
        changeStackId: stack.id.value,
        problems: problems.map((each) => each.message),
      },
      'A reordered change stack kept breaking its rules; keeping the checked one',
    );

    return reordering.gaveUpReordering();
  }
}
