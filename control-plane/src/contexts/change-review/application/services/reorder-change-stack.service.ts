import type { ChangeStackDrafterPort } from '@change-review/application/ports/change-stack-drafter.port';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import {
  InvalidChangeStackError,
  type StackProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import { arranged } from '@change-review/domain/services/arrange-stack';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const ATTEMPTS = 2;

export class ReorderChangeStack {
  constructor(
    private readonly drafter: ChangeStackDrafterPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async reordered(stack: ChangeStack): Promise<ChangeStack> {
    if (stack.failedLayers().length === 0) {
      return stack.keepLayers();
    }

    const { diff, facts } = stack;
    let problems: readonly StackProblem[] = [];

    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      const cohorts = await this.drafter.draft({
        diff,
        repository: stack.repository,
        facts,
        problems,
        reordering: stack,
      });

      try {
        return stack.reordered(
          arranged(diff, facts, cohorts),
          this.clock.now(),
          attempt < ATTEMPTS,
        );
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

    return stack.keepLayers();
  }
}
