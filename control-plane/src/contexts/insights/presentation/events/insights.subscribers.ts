import type { AlertInbox } from '@insights/application/services/alert-inbox.service';
import type { DeleteInsights } from '@insights/application/services/delete-insights.service';
import type { GradeInboxRequests } from '@insights/application/services/grade-inbox-requests.service';
import type { RecordChangeChecks } from '@insights/application/services/record-change-checks.service';
import type { RecordChangeShape } from '@insights/application/services/record-change-shape.service';
import type { RecordChat } from '@insights/application/services/record-chat.service';
import type { RecordHumanAction } from '@insights/application/services/record-human-action.service';
import type { RecordJudgeScore } from '@insights/application/services/record-judge-score.service';
import type { RecordPullRequests } from '@insights/application/services/record-pull-requests.service';
import type { RecordRunEnding } from '@insights/application/services/record-run-ending.service';
import type { RecordRunMemories } from '@insights/application/services/record-run-memories.service';
import type { RecordRunUsageSummary } from '@insights/application/services/record-run-usage-summary.service';
import type { RecordStationPass } from '@insights/application/services/record-station-pass.service';
import type { RecordSupersededRun } from '@insights/application/services/record-superseded-run.service';
import type { RecordTaskFailure } from '@insights/application/services/record-task-failure.service';
import type { RecordTaskHumanAction } from '@insights/application/services/record-task-human-action.service';
import type { RequestJudging } from '@insights/application/services/request-judging.service';
import type { WatchStations } from '@insights/application/services/watch-stations.service';
import type { PullRequestRecordClosed } from '@insights/domain/events/pull-request-record-closed.event';
import type { RunJudged } from '@insights/domain/events/run-judged.event';
import type { RunOutcomeChanged } from '@insights/domain/events/run-outcome-changed.event';
import type { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import type { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import type { StationAlertFired } from '@insights/domain/events/station-alert-fired.event';
import type { StationAlertReopened } from '@insights/domain/events/station-alert-reopened.event';
import type { StationAlertResolved } from '@insights/domain/events/station-alert-resolved.event';
import { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { observedPullRequestOf } from '@insights/presentation/events/github-pull-request.translation';
import { runEndedOf } from '@insights/presentation/events/run-ended.translation';
import {
  CHANGE_CHECKED,
  type ChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-checked.integration-event';
import {
  CHANGE_STACK_READY,
  type ChangeStackReadyIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-stack-ready.integration-event';
import {
  CHAT_STARTED,
  type ChatStartedIntegrationEvent,
} from '@shared-kernel/application/integration-events/chat-started.integration-event';
import {
  DISPATCH_ENDED,
  type DispatchEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-ended.integration-event';
import {
  DISPATCH_SUPERSEDED,
  type DispatchSupersededIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-superseded.integration-event';
import {
  LINE_CHANGED,
  type LineChangedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-changed.integration-event';
import {
  MEMORIES_USED,
  type MemoriesUsedIntegrationEvent,
} from '@shared-kernel/application/integration-events/memories-used.integration-event';
import {
  PULL_REQUEST_OPENED,
  type PullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import {
  PULL_REQUEST_PURGED,
  type PullRequestPurgedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-purged.integration-event';
import {
  PULL_REQUEST_REVIEW_TAKEN,
  type PullRequestReviewTakenIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-review-taken.integration-event';
import {
  PULL_REQUEST_UPDATED,
  type PullRequestUpdatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-updated.integration-event';
import {
  RUN_USAGE_RECORDED,
  type RunUsageRecordedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-usage-recorded.integration-event';
import {
  TASK_ACTED_ON,
  type TaskActedOnIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-acted-on.integration-event';
import {
  TASK_ASKED,
  type TaskAskedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-asked.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import {
  TASK_FAILED,
  type TaskFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-failed.integration-event';
import {
  TASK_OPENED,
  type TaskOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-opened.integration-event';
import {
  TASK_PASSED,
  type TaskPassedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-passed.integration-event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  WORKSPACE_DELETED,
  type WorkspaceDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface InsightsHandlers {
  readonly ending: RecordRunEnding;
  readonly superseding: RecordSupersededRun;
  readonly checking: RecordChangeChecks;
  readonly acting: RecordHumanAction;
  readonly deleting: DeleteInsights;
  readonly judging: RequestJudging;
  readonly scoring: RecordJudgeScore;
  readonly grading: GradeInboxRequests;
  readonly recordingUsage: RecordRunUsageSummary;
  readonly remembering: RecordRunMemories;
  readonly passing: RecordStationPass;
  readonly failing: RecordTaskFailure;
  readonly recordingHumanActions: RecordTaskHumanAction;
  readonly chatting: RecordChat;
  readonly recording: RecordPullRequests;
  readonly shaping: RecordChangeShape;
  readonly watching: WatchStations;
  readonly alerting: AlertInbox;
}

type DeletedEvent =
  | TaskDeletedIntegrationEvent
  | TeamDeletedIntegrationEvent
  | WorkspaceDeletedIntegrationEvent;

type ScopeKind = DeletionScope['kind'];

const DELETED: Record<ScopeKind, string> = {
  task: TASK_DELETED,
  team: TEAM_DELETED,
  workspace: WORKSPACE_DELETED,
};

const scopeOf = (event: DeletedEvent): DeletionScope => {
  const workspaceId = WorkspaceId.of(event.workspaceId);

  switch (event.kind) {
    case TASK_DELETED:
      return DeletionScope.ofTask(workspaceId, TaskId.of(event.taskId));
    case TEAM_DELETED:
      return DeletionScope.ofTeam(workspaceId, TeamId.of(event.teamId));
    case WORKSPACE_DELETED:
      return DeletionScope.ofWorkspace(workspaceId);
  }
};

const EVERY_SCOPE: readonly ScopeKind[] = ['task', 'team', 'workspace'];

const ERASED: readonly {
  readonly name: string;
  readonly scopes: readonly ScopeKind[];
  readonly erase: (
    deleting: DeleteInsights,
    scope: DeletionScope,
  ) => Promise<void>;
}[] = [
  {
    name: 'runs',
    scopes: EVERY_SCOPE,
    erase: (deleting, scope) => deleting.runRecords(scope),
  },
  {
    name: 'judgings',
    scopes: EVERY_SCOPE,
    erase: (deleting, scope) => deleting.judgings(scope),
  },
  {
    name: 'scores',
    scopes: EVERY_SCOPE,
    erase: (deleting, scope) => deleting.scores(scope),
  },
  {
    name: 'human-actions',
    scopes: EVERY_SCOPE,
    erase: (deleting, scope) => deleting.humanActions(scope),
  },
  {
    name: 'failures',
    scopes: EVERY_SCOPE,
    erase: (deleting, scope) => deleting.failures(scope),
  },
  {
    name: 'change-shapes',
    scopes: EVERY_SCOPE,
    erase: (deleting, scope) => deleting.changeShapes(scope),
  },
  {
    name: 'pull-requests',
    scopes: EVERY_SCOPE,
    erase: (deleting, scope) => deleting.pullRequests(scope),
  },
  {
    name: 'alerts',
    scopes: EVERY_SCOPE,
    erase: (deleting, scope) => deleting.alertStates(scope),
  },
  {
    name: 'chats',
    scopes: ['team', 'workspace'],
    erase: (deleting, scope) => deleting.chats(scope),
  },
];

const deletionSubscriber = (
  scope: ScopeKind,
  name: string,
  erase: (scope: DeletionScope) => Promise<void>,
): DomainEventSubscriber =>
  subscribing<DeletedEvent>(
    `insights.delete-${name}-of-deleted-${scope}`,
    [DELETED[scope]],
    (event) => erase(scopeOf(event)),
    { callsOut: true },
  );

export const insightsSubscribers = (
  handlers: InsightsHandlers,
): readonly DomainEventSubscriber[] => [
  subscribing<DispatchEndedIntegrationEvent>(
    'insights.record-ended-run',
    [DISPATCH_ENDED],
    (event) => handlers.ending.ended(runEndedOf(event)),
  ),
  subscribing<DispatchEndedIntegrationEvent>(
    'insights.judge-ended-run',
    [DISPATCH_ENDED],
    (event) => handlers.judging.runEnded(runEndedOf(event)),
  ),
  subscribing<RunJudged>(
    'insights.record-judge-score',
    ['judging.judged'],
    (event) => handlers.scoring.judged(event),
  ),
  subscribing<ScoreRecorded>(
    'insights.ask-or-resolve-grade',
    ['score.recorded'],
    (event) => handlers.grading.recorded(event),
  ),
  subscribing<RunRecordEnded>(
    'insights.watch-station-after-run',
    ['run-record.ended'],
    (event) => handlers.watching.runEnded(event),
  ),
  subscribing<RunOutcomeChanged>(
    'insights.watch-station-after-run-outcome-changed',
    ['run-record.outcome-changed'],
    (event) => handlers.watching.outcomeChanged(event),
  ),
  subscribing<PullRequestRecordClosed>(
    'insights.watch-stations-after-closed-pull-request',
    ['pull-request-record.closed'],
    (event) => handlers.watching.pullRequestClosed(event),
    { callsOut: true },
  ),
  subscribing<StationAlertFired | StationAlertResolved | StationAlertReopened>(
    'insights.follow-station-alert-inbox-request',
    ['station-alert.fired', 'station-alert.resolved', 'station-alert.reopened'],
    (event) => handlers.alerting.moved(event),
  ),
  subscribing<LineChangedIntegrationEvent>(
    'insights.watch-stations-after-line-changed',
    [LINE_CHANGED],
    (event) => handlers.watching.lineChanged(event),
    { callsOut: true },
  ),
  subscribing<DispatchSupersededIntegrationEvent>(
    'insights.record-superseded-run',
    [DISPATCH_SUPERSEDED],
    (event) =>
      handlers.superseding.superseded(
        RunId.of(event.runId),
        WorkspaceId.of(event.workspaceId),
        event.taskId ? TaskId.of(event.taskId) : null,
        new Date(event.at),
      ),
  ),
  subscribing<ChangeCheckedIntegrationEvent>(
    'insights.record-checked-change',
    [CHANGE_CHECKED],
    (event) =>
      handlers.checking.checked(
        RunId.of(event.runId),
        WorkspaceId.of(event.workspaceId),
        event.taskId ? TaskId.of(event.taskId) : null,
        event.passed,
        new Date(event.at),
      ),
  ),
  subscribing<TaskActedOnIntegrationEvent>(
    'insights.record-first-human-action',
    [TASK_ACTED_ON],
    (event) => handlers.acting.acted(event),
  ),
  subscribing<RunUsageRecordedIntegrationEvent>(
    'insights.record-run-usage',
    [RUN_USAGE_RECORDED],
    (event) => handlers.recordingUsage.usageRecorded(event),
  ),
  subscribing<MemoriesUsedIntegrationEvent>(
    'insights.record-run-memories',
    [MEMORIES_USED],
    (event) => handlers.remembering.used(event),
  ),
  subscribing<TaskPassedIntegrationEvent>(
    'insights.record-passed-run',
    [TASK_PASSED],
    (event) => handlers.passing.passed(event),
  ),
  subscribing<TaskFailedIntegrationEvent>(
    'insights.record-task-failure',
    [TASK_FAILED],
    (event) => handlers.failing.failed(event),
  ),
  subscribing<TaskOpenedIntegrationEvent>(
    'insights.record-task-opening',
    [TASK_OPENED],
    (event) => handlers.recordingHumanActions.opened(event),
  ),
  subscribing<TaskAskedIntegrationEvent>(
    'insights.record-inbox-ask',
    [TASK_ASKED],
    (event) => handlers.recordingHumanActions.asked(event),
  ),
  subscribing<TaskActedOnIntegrationEvent>(
    'insights.record-task-human-action',
    [TASK_ACTED_ON],
    (event) => handlers.recordingHumanActions.acted(event),
  ),
  subscribing<ChatStartedIntegrationEvent>(
    'insights.record-started-chat',
    [CHAT_STARTED],
    (event) => handlers.chatting.started(event),
  ),
  subscribing<PullRequestUpdatedIntegrationEvent>(
    'insights.record-seen-pull-request',
    [PULL_REQUEST_UPDATED],
    (event) =>
      handlers.recording.seen({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        observed: observedPullRequestOf(event),
      }),
  ),
  subscribing<PullRequestPurgedIntegrationEvent>(
    'insights.delete-pull-request-purged-by-github',
    [PULL_REQUEST_PURGED],
    (event) =>
      handlers.recording.purgedByGitHub({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        updatedAt: new Date(event.updatedAt),
      }),
  ),
  subscribing<PullRequestOpenedIntegrationEvent>(
    'insights.record-pull-request-owner',
    [PULL_REQUEST_OPENED],
    (event) =>
      handlers.recording.owned({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.url),
        taskId: TaskId.of(event.taskId),
        teamId: TeamId.of(event.teamId),
        at: new Date(event.at),
      }),
  ),
  subscribing<PullRequestReviewTakenIntegrationEvent>(
    'insights.record-pull-request-review-task',
    [PULL_REQUEST_REVIEW_TAKEN],
    (event) =>
      handlers.recording.reviewed({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.url),
        taskId: TaskId.of(event.taskId),
        teamId: TeamId.of(event.teamId),
      }),
  ),
  subscribing<ChangeStackReadyIntegrationEvent>(
    'insights.record-change-shape',
    [CHANGE_STACK_READY],
    (event) =>
      handlers.shaping.shaped({
        runId: event.runId,
        taskId: event.taskId,
        workspaceId: event.workspaceId,
        shape: {
          changeTitles: event.changeTitles,
          changeIntents: event.changeIntents,
          at: new Date(event.at),
        },
      }),
  ),
  ...ERASED.flatMap(({ name, scopes, erase }) =>
    scopes.map((scope) =>
      deletionSubscriber(scope, name, (deleted) =>
        erase(handlers.deleting, deleted),
      ),
    ),
  ),
];
