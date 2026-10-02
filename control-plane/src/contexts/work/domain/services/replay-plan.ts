import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { UnreplayableRunError } from '@work/domain/exceptions/unreplayable-run.error';
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
import type { BriefedTask } from '@work/domain/value-objects/briefed-task.vo';
import { Continuity } from '@work/domain/value-objects/continuity.vo';
import { ContinuityKey } from '@work/domain/value-objects/continuity-key.vo';
import { Declaration } from '@work/domain/value-objects/declaration.vo';
import { DONE } from '@work/domain/value-objects/handover-word';
import type { RunReplay } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import type { StartedCheckout } from '@work/domain/value-objects/started-checkout.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { WorkspaceArchiveId } from '@work/domain/value-objects/workspace-archive-id.vo';

export interface ReplayPlan {
  readonly subject: RunSubject;
  readonly taskId: TaskId;
  readonly briefed: BriefedTask;
  readonly at: OrderedAt;
  readonly archive: WorkspaceArchiveId | null;
  readonly startedAt: Date;
  readonly replay: RunReplay;
}

const refused = (
  original: Run,
  refusal: UnreplayableRunError['refusal'],
  reason: string,
): never => {
  throw new UnreplayableRunError(original.id.value, refusal, reason);
};

const checkoutsAt = (
  original: Run,
  started: readonly StartedCheckout[],
  briefed: BriefedTask,
  candidate: Line,
): TaskCheckout[] => {
  const worked = repositoriesReviewedOrAll(briefed.reviewing, candidate);

  return started.map((each) => {
    const repository =
      worked.find((repository) => repository.name === each.path) ??
      refused(
        original,
        'repository-gone',
        `it checked out ${each.path}, which the line no longer works`,
      );

    return {
      repository,
      branch: null,
      ref: each.commit,
      diffOf: briefed.reviewing ? 'commits' : 'worktree',
      setup: candidate.repositories.setupOf(repository),
    };
  });
};

const UNHELD = { awaitingReview: false, heldBackTo: null } as const;

const movesOnAfter = (candidate: Line, stationId: StationId): string[] =>
  [
    ...new Set([
      ...candidate.optionsFrom(stationId).map((each) => each.word),
      DONE,
    ]),
  ]
    .map((word) => word.toLowerCase())
    .filter((word) => {
      const routing = routeAfterRun(
        HandoverFor.declared(
          Declaration.of({ next: word }),
          candidate,
          stationId,
        ),
        candidate,
        UNHELD,
      );

      return !putsItToAPerson(routing);
    });

export const replayPlanFor = ({
  original,
  briefed,
  candidate,
  id,
}: {
  original: Run;
  briefed: BriefedTask | null;
  candidate: Line;
  id: RunId;
}): ReplayPlan => {
  const taskId =
    original.taskId ??
    refused(original, 'not-a-task-run', 'it worked no task of its own');
  const stationId =
    original.stationId ??
    refused(original, 'not-a-task-run', 'it worked at no station');
  if (!original.hasEnded) {
    refused(original, 'still-running', 'it has not ended yet');
  }

  const started =
    original.startedFrom ??
    refused(original, 'no-starting-point', 'it never said where it started');
  const task =
    briefed ??
    refused(
      original,
      'no-briefing',
      'the task it was briefed with was never kept',
    );

  if (!candidate.stationAt(stationId)) {
    refused(
      original,
      'not-at-the-station',
      'the candidate line has no station where it worked',
    );
  }

  const checkouts = checkoutsAt(original, started.checkouts, task, candidate);

  return {
    subject: RunSubject.replay(
      original.id,
      taskId,
      stationId,
      candidate.teamId,
    ),
    taskId,
    briefed: task,
    at: {
      stationId,
      continuity: Continuity.of({ key: ContinuityKey.forReplay(id.value) }),
      checkouts,
    },
    archive: started.archive,
    startedAt: started.at,
    replay: {
      archive: started.archive?.value ?? null,
      checkouts: checkouts.map((each, at) => ({
        path: each.repository.name,
        commit: started.checkouts[at]?.commit ?? '',
        repository: each.repository.value,
      })),
      movesOnAfter: movesOnAfter(candidate, stationId),
    },
  };
};
