import { HANDOVER_TO_FINISH } from '@shared-kernel/domain/value-objects/handover-word';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UntrialableRunError } from '@work/domain/exceptions/untrialable-run.error';
import { HandoverFor } from '@work/domain/services/handover-for';
import {
  putsItToAPerson,
  routeAfterRun,
} from '@work/domain/services/route-after-run';
import type { OrderedAt } from '@work/domain/services/run-order';
import {
  repositoriesReviewedOrAll,
  type TaskCheckout,
} from '@work/domain/services/task-checkouts';
import { trialRepositoriesBlockOf } from '@work/domain/services/trialability';
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Resume } from '@work/domain/value-objects/resume.vo';
import type { UntrialableReason } from '@work/domain/value-objects/untrialable-reason';

interface StartedCheckoutFact {
  readonly checkedOutAt: string;
  readonly repository: Repository | null;
  readonly commit: string;
}

export interface TrialOriginal {
  readonly runId: RunId;
  readonly taskId: TaskId;
  readonly stationId: StationId;
  readonly archive: string | null;
  readonly startedAt: Date;
  readonly checkouts: readonly StartedCheckoutFact[];
}

interface TrialCheckoutPlan {
  readonly repository: Repository;
  readonly commit: string;
}

export interface TrialPlan {
  readonly at: OrderedAt;
  readonly checkouts: readonly TrialCheckoutPlan[];
  readonly movesOnAfter: readonly string[];
}

const untrialable = (
  original: TrialOriginal,
  reason: UntrialableReason,
  description: string,
): never => {
  throw new UntrialableRunError(original.runId.value, reason, description);
};

const checkoutsAt = (
  original: TrialOriginal,
  briefed: BriefedTask,
  candidate: LineMap,
): TaskCheckout[] => {
  const repositories = repositoriesReviewedOrAll(briefed.reviewing, candidate);
  const block = trialRepositoriesBlockOf(original.checkouts, repositories);

  if (block) {
    untrialable(original, block.reason, block.description);
  }

  const diffOf = briefed.reviewing ? 'commits' : 'worktree';

  return original.checkouts.flatMap((each) =>
    repositories
      .filter((repository) => each.repository?.equals(repository) ?? false)
      .map((repository) => ({
        repository,
        branch: null,
        base: null,
        ref: each.commit,
        diffOf,
        setup: candidate.repositories.setupOf(repository),
      })),
  );
};

const NOT_DEFERRED = {
  awaitingReview: false,
  deferredMoveTo: null,
  onHold: false,
} as const;

const movesOnAfter = (candidate: LineMap, stationId: StationId): string[] =>
  [
    ...new Set([
      ...candidate.optionsFrom(stationId).map((each) => each.word),
      HANDOVER_TO_FINISH,
    ]),
  ]
    .map((word) => word.toLowerCase())
    .filter((word) => {
      const routing = routeAfterRun(
        HandoverFor.resolve(Handover.of({ next: word }), candidate, stationId),
        candidate,
        NOT_DEFERRED,
      );

      return !putsItToAPerson(routing);
    });

export const trialPlanFor = ({
  original,
  briefed,
  candidate,
}: {
  original: TrialOriginal;
  briefed: BriefedTask;
  candidate: LineMap;
}): TrialPlan => {
  if (!candidate.stationAt(original.stationId)) {
    untrialable(
      original,
      'not-at-the-station',
      `The candidate line has no station ${original.stationId.value}.`,
    );
  }

  const checkouts = checkoutsAt(original, briefed, candidate);

  return {
    at: {
      stationId: original.stationId,
      resume: Resume.of({}),
      checkouts,
    },
    checkouts: checkouts.map((each, at) => ({
      repository: each.repository,
      commit: original.checkouts[at]?.commit ?? '',
    })),
    movesOnAfter: movesOnAfter(candidate, original.stationId),
  };
};
