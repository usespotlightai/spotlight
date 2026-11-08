import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import {
  ATTEMPTS,
  attempted,
} from '@change-review/application/services/generation-attempt';
import {
  InvalidChangeStackError,
  type StackProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import {
  type DiffFacts,
  placedHunks,
} from '@change-review/domain/services/diff-facts';
import type { PreviousStack } from '@change-review/domain/services/previous-stack';
import type { RedraftRequest } from '@change-review/domain/services/redraft-request';
import { StackOutline } from '@change-review/domain/services/stack-outline';
import { stackPartOf } from '@change-review/domain/services/stack-part';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type {
  OutlinedCohort,
  ProposedCohort,
  StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

const MAX_HUNKS_PER_CALL = 80;

export const exceedsOneCall = (facts: DiffFacts): boolean =>
  placedHunks(facts).length > MAX_HUNKS_PER_CALL;

export type CohortLayering =
  | {
      readonly outcome: 'layered';
      readonly cohort: ProposedCohort;
      readonly proposed: ProposedCohort;
      readonly usage: readonly ModelCall[];
    }
  | {
      readonly outcome: 'unanswered';
      readonly truncated: boolean;
      readonly error: unknown;
      readonly usage: readonly ModelCall[];
    }
  | {
      readonly outcome: 'broken';
      readonly problems: readonly StackProblem[];
      readonly usage: readonly ModelCall[];
    };

export const layerCohort = async (
  generator: ChangeStackGeneratorPort,
  request: {
    diff: Diff;
    facts: DiffFacts;
    repository: RepositoryName | null;
    cohort: OutlinedCohort;
    redraft?: RedraftRequest | null;
    redrafting?: StackCohort;
    previous?: PreviousStack | null;
  },
): Promise<CohortLayering> => {
  const { cohort, repository, redraft, redrafting, previous } = request;
  const part = stackPartOf(request.diff, request.facts, cohort.hunks);
  const usage: ModelCall[] = [];
  let problems: readonly StackProblem[] = [];

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const attempt = await attempted(() =>
      generator.layers({
        part,
        repository,
        cohort,
        problems,
        redraft,
        previous,
      }),
    );
    const call = attempt.generated ? attempt.answer.usage : attempt.usage;

    if (call) {
      usage.push(call);
    }

    if (!attempt.generated) {
      return {
        outcome: 'unanswered',
        truncated: attempt.truncated,
        error: attempt.error,
        usage,
      };
    }

    try {
      return {
        outcome: 'layered',
        cohort: StackOutline.layered(
          part,
          cohort,
          attempt.answer.layers,
          redrafting,
        ),
        proposed: StackOutline.proposed(cohort, attempt.answer.layers),
        usage,
      };
    } catch (error) {
      if (!(error instanceof InvalidChangeStackError)) {
        throw error;
      }
      problems = error.problems;
    }
  }

  return { outcome: 'broken', problems, usage };
};

const LAYERINGS_PER_ROUND = 4;

export const layeredInRounds = async (
  layerings: readonly (() => Promise<CohortLayering>)[],
  rounds: {
    readonly before: () => Promise<void>;
    readonly after: (round: readonly CohortLayering[]) => void;
  },
): Promise<CohortLayering[]> => {
  const done: CohortLayering[] = [];

  for (let at = 0; at < layerings.length; at += LAYERINGS_PER_ROUND) {
    await rounds.before();
    const settled = await Promise.allSettled(
      layerings
        .slice(at, at + LAYERINGS_PER_ROUND)
        .map((layering) => layering()),
    );
    const round = settled.flatMap((each) =>
      each.status === 'fulfilled' ? [each.value] : [],
    );
    rounds.after(round);

    const crash = settled.find((each) => each.status === 'rejected');

    if (crash) {
      throw crash.reason;
    }

    done.push(...round);
  }

  return done;
};

export type CombinedLayerings =
  | {
      readonly outcome: 'layered';
      readonly cohorts: readonly ProposedCohort[];
      readonly proposed: readonly ProposedCohort[];
    }
  | {
      readonly outcome: 'unanswered';
      readonly truncated: boolean;
      readonly error: unknown;
    }
  | {
      readonly outcome: 'broken';
      readonly problems: readonly StackProblem[];
    };

export const combined = (
  layerings: readonly CohortLayering[],
): CombinedLayerings => {
  const unanswered = layerings.flatMap((each) =>
    each.outcome === 'unanswered' ? [each] : [],
  );
  const failure = unanswered.find((each) => each.truncated) ?? unanswered[0];

  if (failure) {
    return {
      outcome: 'unanswered',
      truncated: failure.truncated,
      error: failure.error,
    };
  }

  const problems = layerings.flatMap((each) =>
    each.outcome === 'broken' ? each.problems : [],
  );

  return problems.length > 0
    ? { outcome: 'broken', problems }
    : {
        outcome: 'layered',
        cohorts: layerings.flatMap((each) =>
          each.outcome === 'layered' ? [each.cohort] : [],
        ),
        proposed: layerings.flatMap((each) =>
          each.outcome === 'layered' ? [each.proposed] : [],
        ),
      };
};
