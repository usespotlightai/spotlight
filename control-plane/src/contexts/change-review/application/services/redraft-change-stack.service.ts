import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import {
  combined,
  exceedsOneCall,
  layerCohort,
  layeredInRounds,
} from '@change-review/application/services/cohort-layering';
import {
  ATTEMPTS,
  attempted,
  settleBroken,
  settleUnanswered,
} from '@change-review/application/services/generation-attempt';
import { withRenewedLease } from '@change-review/application/services/job-lease';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import {
  InvalidChangeStackError,
  type StackProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import {
  cohortRedraft,
  type RedraftRequest,
} from '@change-review/domain/services/redraft-request';
import { StackOutline } from '@change-review/domain/services/stack-outline';
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

    if (!redraft) {
      return stack.stopRedrafting();
    }

    return exceedsOneCall(stack.facts)
      ? this.byCohort(stack, redraft)
      : this.whole(stack, redraft);
  }

  private async whole(
    stack: ChangeStack,
    redraft: RedraftRequest,
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
        return settleUnanswered(
          redrafting.recordModel(attempt.usage),
          attempt,
          this.clock.now(),
          this.logger,
        );
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

    return settleBroken(redrafting, problems, this.clock.now(), this.logger);
  }

  private async byCohort(
    stack: ChangeStack,
    redraft: RedraftRequest,
  ): Promise<ChangeStack> {
    let redrafting = stack;
    const layered = combined(
      await layeredInRounds(
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
                  redrafting: cohort,
                })
            : async () => ({
                outcome: 'layered' as const,
                cohort: StackOutline.kept(cohort),
                proposed: StackOutline.kept(cohort),
                usage: [],
              });
        }),
        {
          before: async () => {
            redrafting = await withRenewedLease(
              this.stacks,
              redrafting,
              this.clock.now(),
            );
          },
          after: (round) => {
            for (const call of round.flatMap((each) => each.usage)) {
              redrafting = redrafting.recordModel(call);
            }
          },
        },
      ),
    );

    if (layered.outcome === 'unanswered') {
      return settleUnanswered(
        redrafting,
        layered,
        this.clock.now(),
        this.logger,
      );
    }
    if (layered.outcome === 'broken') {
      return settleBroken(
        redrafting,
        layered.problems,
        this.clock.now(),
        this.logger,
      );
    }

    try {
      return redrafting.redrafted(
        layered.cohorts,
        this.clock.now(),
        layered.proposed,
      );
    } catch (error) {
      if (!(error instanceof InvalidChangeStackError)) {
        throw error;
      }
      return settleBroken(
        redrafting,
        error.problems,
        this.clock.now(),
        this.logger,
      );
    }
  }
}
