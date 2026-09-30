import type { AskForJudging } from '@outcomes/application/services/ask-for-judging.service';
import type { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
import type { GradeAsides } from '@outcomes/application/services/grade-asides.service';
import type { NoteChangeChecked } from '@outcomes/application/services/note-change-checked.service';
import type { NotePersonAct } from '@outcomes/application/services/note-person-act.service';
import type { NotePullRequestClosed } from '@outcomes/application/services/note-pull-request-closed.service';
import type { NotePullRequestOpened } from '@outcomes/application/services/note-pull-request-opened.service';
import type { NoteRunEnded } from '@outcomes/application/services/note-run-ended.service';
import type { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import type { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import type { RunJudged } from '@outcomes/domain/events/run-judged.event';
import type { ScoreRecorded } from '@outcomes/domain/events/score-recorded.event';
import {
  CHANGE_CHECKED,
  type ChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-checked.integration-event';
import {
  PULL_REQUEST_CLOSED,
  type PullRequestClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import {
  PULL_REQUEST_OPENED,
  type PullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  RUN_SUPERSEDED,
  type RunSupersededIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-superseded.integration-event';
import {
  TASK_ACTED_ON,
  type TaskActedOnIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-acted-on.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import {
  TEAM_DISBANDED,
  type TeamDisbandedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-disbanded.integration-event';
import {
  WORKSPACE_CLOSED,
  type WorkspaceClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-closed.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface OutcomesReactions {
  readonly ending: NoteRunEnded;
  readonly superseding: NoteRunSuperseded;
  readonly checking: NoteChangeChecked;
  readonly acting: NotePersonAct;
  readonly opening: NotePullRequestOpened;
  readonly closing: NotePullRequestClosed;
  readonly forgetting: ForgetOutcomes;
  readonly judging: AskForJudging;
  readonly scoring: RecordJudgeScore;
  readonly grading: GradeAsides;
}

export const outcomesSubscribers = (
  reactions: OutcomesReactions,
): readonly DomainEventSubscriber[] => [
  subscribing<RunEndedIntegrationEvent>(
    'outcomes.record-ended-run',
    [RUN_ENDED],
    (event) =>
      event.taskId && event.stationId
        ? reactions.ending.ended(event)
        : Promise.resolve(),
  ),
  subscribing<RunEndedIntegrationEvent>(
    'outcomes.judge-ended-run',
    [RUN_ENDED],
    (event) =>
      event.taskId && event.stationId
        ? reactions.judging.runEnded(event)
        : Promise.resolve(),
  ),
  subscribing<RunJudged>(
    'outcomes.record-judge-score',
    ['judging.judged'],
    (event) => reactions.scoring.judged(event),
  ),
  subscribing<ScoreRecorded>(
    'outcomes.ask-or-settle-grade',
    ['score.recorded'],
    (event) => reactions.grading.recorded(event),
  ),
  subscribing<RunSupersededIntegrationEvent>(
    'outcomes.record-superseded-run',
    [RUN_SUPERSEDED],
    (event) =>
      event.taskId
        ? reactions.superseding.superseded(
            RunId.of(event.runId),
            WorkspaceId.of(event.workspaceId),
            TaskId.of(event.taskId),
          )
        : Promise.resolve(),
  ),
  subscribing<ChangeCheckedIntegrationEvent>(
    'outcomes.record-checked-change',
    [CHANGE_CHECKED],
    (event) =>
      reactions.checking.checked(
        RunId.of(event.runId),
        WorkspaceId.of(event.workspaceId),
        event.taskId ? TaskId.of(event.taskId) : null,
        event.passed,
      ),
  ),
  subscribing<TaskActedOnIntegrationEvent>(
    'outcomes.record-next-person-act',
    [TASK_ACTED_ON],
    (event) => reactions.acting.acted(event),
  ),
  subscribing<PullRequestOpenedIntegrationEvent>(
    'outcomes.record-opened-pull-request',
    [PULL_REQUEST_OPENED],
    (event) =>
      reactions.opening.opened(
        TaskId.of(event.taskId),
        WorkspaceId.of(event.workspaceId),
        PullRequestUrl.of(event.url),
      ),
  ),
  subscribing<PullRequestClosedIntegrationEvent>(
    'outcomes.record-closed-pull-request',
    [PULL_REQUEST_CLOSED],
    (event) =>
      reactions.closing.closed({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        merged: event.merged,
        at: event.closedAt ? new Date(event.closedAt) : null,
      }),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.forget-runs-of-deleted-task',
    [TASK_DELETED],
    (event) => reactions.forgetting.runsOfTask(TaskId.of(event.taskId)),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.forget-delivery-of-deleted-task',
    [TASK_DELETED],
    (event) => reactions.forgetting.deliveryOfTask(TaskId.of(event.taskId)),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.forget-judgings-and-scores-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.forgetting.judgingsAndScoresOfTask(TaskId.of(event.taskId)),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'outcomes.forget-judgings-and-scores-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.forgetting.judgingsAndScoresOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'outcomes.forget-runs-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.forgetting.runsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'outcomes.forget-runs-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.forgetting.runsOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'outcomes.forget-deliveries-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.forgetting.deliveriesOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'outcomes.forget-judgings-and-scores-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.forgetting.judgingsAndScoresOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
];
