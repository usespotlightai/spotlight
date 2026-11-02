import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import {
  combined,
  inTurn,
  layerCohort,
  splits,
} from '@change-review/application/services/cohort-layering';
import { attempted } from '@change-review/application/services/generation-attempt';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import {
  InvalidChangeStackError,
  type StackProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import {
  cohortRedraft,
  type RedraftRequest,
  redraftRequestOf,
} from '@change-review/domain/services/redraft-request';
import { StackOutline } from '@change-review/domain/services/stack-outline';
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

    const redraft = redraftRequestOf(stack, check);

    if (!splits(stack.facts)) {
      return this.whole(stack, redraft);
    }

    return redraft ? this.byCohort(stack, redraft) : stack.stopRedrafting();
  }

  private async whole(
    stack: ChangeStack,
    redraft: RedraftRequest | null,
  ): Promise<ChangeStack> {
    const { diff, facts } = stack;
    let problems: readonly StackProblem[] = [];
    let redrafting = stack;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      const attempt = await attempted(() =>
        this.generator.generate({
          diff,
          repository: stack.repository,
          facts,
          problems,
          redraft,
        }),
      );

      if (!attempt.generated) {
        return this.unanswered(redrafting.recordModel(attempt.usage), attempt);
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

    return this.broken(redrafting, problems);
  }

  private async byCohort(
    stack: ChangeStack,
    redraft: RedraftRequest,
  ): Promise<ChangeStack> {
    const layered = combined(
      await inTurn(
        stack.cohorts.map((cohort, c) => {
          const scoped = cohortRedraft(redraft, c);

          return scoped
            ? () =>
                layerCohort(this.generator, {
                  diff: stack.diff,
                  facts: stack.facts,
                  repository: stack.repository,
                  cohort: StackOutline.of(cohort),
                  redraft: scoped,
                })
            : async () => ({
                outcome: 'layered' as const,
                cohort: StackOutline.kept(cohort),
                usage: [],
              });
        }),
      ),
    );

    let redrafting = stack;

    for (const call of layered.usage) {
      redrafting = redrafting.recordModel(call);
    }

    if (layered.outcome === 'unanswered') {
      return this.unanswered(redrafting, layered);
    }
    if (layered.outcome === 'broken') {
      return this.broken(redrafting, layered.problems);
    }

    try {
      return redrafting.redrafted(layered.cohorts, this.clock.now());
    } catch (error) {
      if (!(error instanceof InvalidChangeStackError)) {
        throw error;
      }
      return this.broken(redrafting, error.problems);
    }
  }

  private unanswered(
    stack: ChangeStack,
    failure: { readonly truncated: boolean; readonly error: unknown },
  ): ChangeStack {
    if (failure.truncated) {
      this.logger.warn(
        { changeStackId: stack.id.value, err: failure.error },
        'A redraft ran out of output tokens; keeping the checked stack',
      );
      return stack.stopRedrafting();
    }

    this.logger.error(
      { changeStackId: stack.id.value, err: failure.error },
      'Redrafting a change stack failed; scheduling a retry',
    );
    return stack.scheduleRetry(this.clock.now());
  }

  private broken(
    stack: ChangeStack,
    problems: readonly StackProblem[],
  ): ChangeStack {
    this.logger.warn(
      {
        changeStackId: stack.id.value,
        problems: problems.map((each) => each.message),
      },
      'A redrafted change stack kept breaking its rules; keeping the checked one',
    );

    return stack.stopRedrafting();
  }
}
