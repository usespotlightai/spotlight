import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import { attempted } from '@change-review/application/services/generation-attempt';
import {
  InvalidChangeStackError,
  type StackProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { DiffFacts } from '@change-review/domain/services/diff-facts';
import type { RedraftRequest } from '@change-review/domain/services/redraft-request';
import { StackOutline } from '@change-review/domain/services/stack-outline';
import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import type { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type {
  OutlinedCohort,
  ProposedCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

const ATTEMPTS = 2;

export const SPLIT_ABOVE = 80;

export const splits = (facts: DiffFacts): boolean =>
  facts.hunks.filter((each) => !each.incidental).length > SPLIT_ABOVE;

export type CohortLayering =
  | {
      readonly outcome: 'layered';
      readonly cohort: ProposedCohort;
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
  },
): Promise<CohortLayering> => {
  const { cohort, repository, redraft } = request;
  const part = StackOutline.partOf(request.diff, request.facts, cohort.hunks);
  const usage: ModelCall[] = [];
  let problems: readonly StackProblem[] = [];

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const attempt = await attempted(() =>
      generator.layers({ part, repository, cohort, problems, redraft }),
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
        cohort: StackOutline.layered(part, cohort, attempt.answer.layers),
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

const LAYERINGS_AT_ONCE = 4;

export const inTurn = async (
  layerings: readonly (() => Promise<CohortLayering>)[],
): Promise<CohortLayering[]> => {
  const done: CohortLayering[] = [];
  let next = 0;

  const worker = async () => {
    while (next < layerings.length) {
      const at = next;
      next += 1;
      const layering = layerings[at];

      if (layering) {
        done[at] = await layering();
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(LAYERINGS_AT_ONCE, layerings.length) },
      worker,
    ),
  );

  return done;
};

export type CombinedLayerings =
  | {
      readonly outcome: 'layered';
      readonly cohorts: readonly ProposedCohort[];
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

export const combined = (
  layerings: readonly CohortLayering[],
): CombinedLayerings => {
  const usage = layerings.flatMap((each) => each.usage);
  const unanswered = layerings.flatMap((each) =>
    each.outcome === 'unanswered' ? [each] : [],
  );
  const failure = unanswered.find((each) => each.truncated) ?? unanswered[0];

  if (failure) {
    return { ...failure, usage };
  }

  const problems = layerings.flatMap((each) =>
    each.outcome === 'broken' ? each.problems : [],
  );

  return problems.length > 0
    ? { outcome: 'broken', problems, usage }
    : {
        outcome: 'layered',
        cohorts: layerings.flatMap((each) =>
          each.outcome === 'layered' ? [each.cohort] : [],
        ),
        usage,
      };
};
