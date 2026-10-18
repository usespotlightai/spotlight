import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import { attemptGeneration } from '@change-review/application/services/generation-attempt';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import {
  InvalidChangeStackError,
  type StackProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import { redraftRequestOf } from '@change-review/domain/services/redraft-request';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const ATTEMPTS = 2;

export class RedraftChangeStack {
  constructor(
    private readonly generator: ChangeStackGeneratorPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async redrafted(stack: ChangeStack, check: StackCheck): Promise<ChangeStack> {
    if (check.failedLayers().length === 0) {
      return stack.stopRedrafting();
    }

    const { diff, facts } = stack;
    let problems: readonly StackProblem[] = [];
    let redrafting = stack;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      const attempt = await attemptGeneration(this.generator, {
        diff,
        repository: stack.repository,
        facts,
        problems,
        redraft: redraftRequestOf(stack, check),
      });

      if (!attempt.generated) {
        this.logger.error(
          { changeStackId: stack.id.value, error: attempt.error },
          'Redrafting a change stack failed; scheduling a retry',
        );
        return redrafting
          .recordModel(attempt.usage)
          .scheduleRetry(this.clock.now());
      }

      const { cohorts, usage } = attempt.answer;
      redrafting = redrafting.recordModel(usage);

      try {
        return redrafting.redrafted(cohorts, this.clock.now());
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
      'A redrafted change stack kept breaking its rules; keeping the checked one',
    );

    return redrafting.stopRedrafting();
  }
}
