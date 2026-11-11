import type { ProjectPullRequestFacts } from '@insights/application/services/project-pull-request-facts.service';
import type { ProjectRunFacts } from '@insights/application/services/project-run-facts.service';
import type { PullRequestOwned } from '@insights/domain/events/pull-request-owned.event';
import type { PullRequestRecordErased } from '@insights/domain/events/pull-request-record-erased.event';
import type { PullRequestReleased } from '@insights/domain/events/pull-request-released.event';
import type { PullRequestReviewTaskAdded } from '@insights/domain/events/pull-request-review-task-added.event';
import type { PullRequestSeen } from '@insights/domain/events/pull-request-seen.event';
import type { RunDismissalRecorded } from '@insights/domain/events/run-dismissal-recorded.event';
import type { RunMemoriesRecorded } from '@insights/domain/events/run-memories-recorded.event';
import type { RunOutcomeChanged } from '@insights/domain/events/run-outcome-changed.event';
import type { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import type { RunRecordErased } from '@insights/domain/events/run-record-erased.event';
import type { TaskChangeShapeErased } from '@insights/domain/events/task-change-shape-erased.event';
import type { TaskChangeShaped } from '@insights/domain/events/task-change-shaped.event';
import type { TaskHumanActionsErased } from '@insights/domain/events/task-human-actions-erased.event';
import type { TaskOpeningRecorded } from '@insights/domain/events/task-opening-recorded.event';
import {
  type EventProjection,
  projecting,
} from '@shared-kernel/application/ports/event-projection.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

type RunChanged =
  | RunRecordEnded
  | RunOutcomeChanged
  | RunMemoriesRecorded
  | RunDismissalRecorded
  | RunRecordErased;

type TaskOpeningChanged = TaskOpeningRecorded | TaskHumanActionsErased;

type PullRequestChanged =
  | PullRequestSeen
  | PullRequestOwned
  | PullRequestReviewTaskAdded
  | PullRequestReleased
  | PullRequestRecordErased;

type ChangeShapeChanged = TaskChangeShaped | TaskChangeShapeErased;

const RUN_CHANGES: readonly string[] = [
  'run-record.ended',
  'run-record.outcome-changed',
  'run-record.memories-recorded',
  'run-record.dismissal-recorded',
  'run-record.erased',
];

const TASK_OPENING_CHANGES: readonly string[] = [
  'task-human-actions.opening-recorded',
  'task-human-actions.erased',
];

const PULL_REQUEST_CHANGES: readonly string[] = [
  'pull-request-record.seen',
  'pull-request-record.owned',
  'pull-request-record.review-task-added',
  'pull-request-record.released',
  'pull-request-record.erased',
];

const CHANGE_SHAPE_CHANGES: readonly string[] = [
  'task-change-shape.shaped',
  'task-change-shape.erased',
];

const changedRun = (event: DomainEvent): event is RunChanged =>
  RUN_CHANGES.includes(event.kind);

const changedTaskOpening = (event: DomainEvent): event is TaskOpeningChanged =>
  TASK_OPENING_CHANGES.includes(event.kind);

const changedPullRequest = (event: DomainEvent): event is PullRequestChanged =>
  PULL_REQUEST_CHANGES.includes(event.kind);

const changedChangeShape = (event: DomainEvent): event is ChangeShapeChanged =>
  CHANGE_SHAPE_CHANGES.includes(event.kind);

const ownersOf = (event: PullRequestChanged): readonly TaskId[] => {
  switch (event.kind) {
    case 'pull-request-record.seen':
    case 'pull-request-record.erased':
      return event.ownerTaskId ? [event.ownerTaskId] : [];
    case 'pull-request-record.owned':
      return event.previousTaskId
        ? [event.taskId, event.previousTaskId]
        : [event.taskId];
    case 'pull-request-record.released':
      return event.taskIds;
    case 'pull-request-record.review-task-added':
      return [];
  }
};

export const insightsProjections = (
  runFacts: ProjectRunFacts,
  pullRequestFacts: ProjectPullRequestFacts,
): readonly EventProjection[] => [
  projecting('insights.project-run-facts-of-run', changedRun, (event) =>
    runFacts.ofRuns([event.runId]),
  ),
  projecting(
    'insights.project-run-facts-of-task-opening',
    changedTaskOpening,
    (event) => runFacts.ofTasks([event.taskId]),
  ),
  projecting(
    'insights.project-run-facts-of-task-pull-request',
    changedPullRequest,
    (event) => runFacts.ofTasks(ownersOf(event)),
  ),
  projecting(
    'insights.project-pull-request-facts',
    changedPullRequest,
    (event) =>
      pullRequestFacts.ofPullRequest(event.workspaceId, event.pullRequest),
  ),
  projecting(
    'insights.project-pull-request-facts-of-change-shape',
    changedChangeShape,
    (event) => pullRequestFacts.ofTask(event.taskId),
  ),
];
