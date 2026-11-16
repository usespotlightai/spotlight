import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import { attempted } from '@change-review/application/services/generation-attempt';
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
import {
  type StackPart,
  stackPartOf,
} from '@change-review/domain/services/stack-part';
import {
  changedLinesOf,
  type Diff,
} from '@change-review/domain/value-objects/diff.vo';
import type { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type {
  DraftedLayerDetails,
  OutlinedCohort,
  ProposedCohort,
  StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type { ModelCall } from '@shared-kernel/domain/value-objects/model-usage.vo';

const MAX_HUNKS_PER_CALL = 80;

const MAX_LINES_PER_CALL = 1_500;

const LAYERING_ATTEMPTS = 4;

const MAX_HUNKS_PER_LAYERING = 40;

const MAX_LINES_PER_LAYERING = 1_200;

const DETAILS_AT_ONCE = 4;

const sizeOf = (diff: Diff, facts: DiffFacts) => {
  const placed = new Set<string>(placedHunks(facts));
  const lines = diff.hunks
    .filter((hunk) => placed.has(hunk.id))
    .reduce((total, hunk) => {
      const { added, removed } = changedLinesOf(hunk);
      return total + added.length + removed.length;
    }, 0);

  return { hunks: placed.size, lines };
};

export const exceedsOneCall = (diff: Diff, facts: DiffFacts): boolean => {
  const { hunks, lines } = sizeOf(diff, facts);
  return hunks > MAX_HUNKS_PER_CALL || lines > MAX_LINES_PER_CALL;
};

const layeredInTwoSteps = (part: StackPart): boolean => {
  const { hunks, lines } = sizeOf(part.diff, part.facts);
  return hunks > MAX_HUNKS_PER_LAYERING || lines > MAX_LINES_PER_LAYERING;
};

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

interface LayeringRequest {
  readonly workspaceId: string;
  readonly diff: Diff;
  readonly facts: DiffFacts;
  readonly repository: RepositoryName | null;
  readonly cohort: OutlinedCohort;
  readonly redraft?: RedraftRequest | null;
  readonly redrafting?: StackCohort;
  readonly previous?: PreviousStack | null;
}

type Detailing =
  | { readonly outcome: 'detailed'; readonly details: DraftedLayerDetails }
  | {
      readonly outcome: 'unanswered';
      readonly truncated: boolean;
      readonly error: unknown;
    }
  | { readonly outcome: 'broken'; readonly problems: readonly StackProblem[] };

const detailLayer = async (
  generator: ChangeStackGeneratorPort,
  request: {
    workspaceId: string;
    part: StackPart;
    repository: RepositoryName | null;
    cohort: OutlinedCohort;
    plan: ProposedCohort;
    layer: number;
  },
  usage: ModelCall[],
): Promise<Detailing> => {
  let problems: readonly StackProblem[] = [];

  for (let attempt = 1; attempt <= LAYERING_ATTEMPTS; attempt += 1) {
    const attempt = await attempted(() =>
      generator.layerDetails({
        workspaceId: request.workspaceId,
        part: request.part,
        repository: request.repository,
        cohort: request.cohort,
        plan: request.plan.layers,
        layer: request.layer,
        problems,
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
      };
    }

    problems = StackOutline.detailProblems(
      request.part,
      request.plan,
      request.layer,
      attempt.answer.details,
    );
    if (problems.length === 0) {
      return { outcome: 'detailed', details: attempt.answer.details };
    }
  }

  return { outcome: 'broken', problems };
};

const layerInTwoSteps = async (
  generator: ChangeStackGeneratorPort,
  request: LayeringRequest,
  part: StackPart,
): Promise<CohortLayering> => {
  const { workspaceId, cohort, repository, redraft, redrafting, previous } =
    request;
  const usage: ModelCall[] = [];
  let problems: readonly StackProblem[] = [];
  let plan: ProposedCohort | null = null;
  let drafted: ProposedCohort | null = null;

  for (let round = 1; !plan && round <= LAYERING_ATTEMPTS; round += 1) {
    const attempt = await attempted(() =>
      generator.layerPlan({
        workspaceId,
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

    drafted = StackOutline.plan(part, cohort, attempt.answer.layers);

    try {
      plan = StackOutline.planned(
        part,
        cohort,
        attempt.answer.layers,
        redrafting,
      );
    } catch (error) {
      if (!(error instanceof InvalidChangeStackError)) {
        throw error;
      }
      problems = error.problems;
    }
  }

  if (!plan) {
    return { outcome: 'broken', problems, usage };
  }

  const settled = plan;
  const detailings: Detailing[] = [];

  for (let at = 0; at < settled.layers.length; at += DETAILS_AT_ONCE) {
    detailings.push(
      ...(await Promise.all(
        settled.layers.slice(at, at + DETAILS_AT_ONCE).map((_, offset) =>
          detailLayer(
            generator,
            {
              workspaceId,
              part,
              repository,
              cohort,
              plan: settled,
              layer: at + offset,
            },
            usage,
          ),
        ),
      )),
    );
  }

  const unanswered = detailings.find((each) => each.outcome === 'unanswered');

  if (unanswered) {
    return { ...unanswered, usage };
  }

  const broken = detailings.flatMap((each) =>
    each.outcome === 'broken' ? each.problems : [],
  );

  if (broken.length > 0) {
    return { outcome: 'broken', problems: broken, usage };
  }

  const detailed = StackOutline.detailed(
    part,
    settled,
    detailings.flatMap((each) =>
      each.outcome === 'detailed' ? [each.details] : [],
    ),
  );

  try {
    return {
      outcome: 'layered',
      cohort: StackOutline.checked(part, detailed, redrafting),
      proposed: drafted ?? detailed,
      usage,
    };
  } catch (error) {
    if (!(error instanceof InvalidChangeStackError)) {
      throw error;
    }
    return { outcome: 'broken', problems: error.problems, usage };
  }
};

export const layerCohort = async (
  generator: ChangeStackGeneratorPort,
  request: LayeringRequest,
): Promise<CohortLayering> => {
  const { workspaceId, cohort, repository, redraft, redrafting, previous } =
    request;
  const part = stackPartOf(request.diff, request.facts, cohort.hunks);

  if (layeredInTwoSteps(part)) {
    return layerInTwoSteps(generator, request, part);
  }

  const usage: ModelCall[] = [];
  let problems: readonly StackProblem[] = [];

  for (let attempt = 1; attempt <= LAYERING_ATTEMPTS; attempt += 1) {
    const attempt = await attempted(() =>
      generator.layers({
        workspaceId,
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
