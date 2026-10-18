import type { AlertInbox } from '@insights/application/services/alert-inbox.service';
import type { DeleteInsights } from '@insights/application/services/delete-insights.service';
import type { GradeAsides } from '@insights/application/services/grade-asides.service';
import type { RecordChangeChecks } from '@insights/application/services/record-change-checks.service';
import type { RecordChangeShape } from '@insights/application/services/record-change-shape.service';
import type { RecordChat } from '@insights/application/services/record-chat.service';
import type { RecordConfigPullRequest } from '@insights/application/services/record-config-pull-request.service';
import type { RecordHumanAction } from '@insights/application/services/record-human-action.service';
import type { RecordJudgeScore } from '@insights/application/services/record-judge-score.service';
import type { RecordPullRequestClosing } from '@insights/application/services/record-pull-request-closing.service';
import type { RecordPullRequestOpening } from '@insights/application/services/record-pull-request-opening.service';
import type { RecordPullRequestReview } from '@insights/application/services/record-pull-request-review.service';
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
import type { RunJudged } from '@insights/domain/events/run-judged.event';
import type { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import type { RunRecordEnriched } from '@insights/domain/events/run-record-enriched.event';
import type { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import type { StationAlertFired } from '@insights/domain/events/station-alert-fired.event';
import type { StationAlertReopened } from '@insights/domain/events/station-alert-reopened.event';
import type { StationAlertResolved } from '@insights/domain/events/station-alert-resolved.event';
import type { TaskPullRequestClosed } from '@insights/domain/events/task-pull-request-closed.event';
import { isMemoryVia } from '@insights/domain/value-objects/run-memories.vo';
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
  CONFIG_PULL_REQUEST_OPENED,
  type ConfigPullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/config-pull-request-opened.integration-event';
import {
  LINE_CHANGED,
  type LineChangedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-changed.integration-event';
import {
  MEMORIES_USED,
  type MemoriesUsedIntegrationEvent,
} from '@shared-kernel/application/integration-events/memories-used.integration-event';
import {
  PULL_REQUEST_CLOSED,
  type PullRequestClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
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
  PULL_REQUEST_REVIEWED,
  type PullRequestReviewedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-reviewed.integration-event';
import {
  PULL_REQUEST_UPDATED,
  type PullRequestUpdatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-updated.integration-event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  RUN_SUPERSEDED,
  type RunSupersededIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-superseded.integration-event';
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
  readonly opening: RecordPullRequestOpening;
  readonly closing: RecordPullRequestClosing;
  readonly deleting: DeleteInsights;
  readonly judging: RequestJudging;
  readonly scoring: RecordJudgeScore;
  readonly grading: GradeAsides;
  readonly recordingUsage: RecordRunUsageSummary;
  readonly remembering: RecordRunMemories;
  readonly passing: RecordStationPass;
  readonly reviewing: RecordPullRequestReview;
  readonly failing: RecordTaskFailure;
  readonly recordingHumanActions: RecordTaskHumanAction;
  readonly chatting: RecordChat;
  readonly recording: RecordPullRequests;
  readonly shaping: RecordChangeShape;
  readonly watching: WatchStations;
  readonly alerting: AlertInbox;
  readonly openingConfigPullRequests: RecordConfigPullRequest;
}

const dateOf = (at: string | null): Date | null => (at ? new Date(at) : null);

const seenOf = (event: PullRequestUpdatedIntegrationEvent) => ({
  repository: event.repository,
  number: event.number,
  title: event.title,
  author: event.author,
  authorIsBot: event.authorIsBot,
  branch: event.branch,
  additions: event.additions,
  deletions: event.deletions,
  changedFiles: event.changedFiles,
  openedAt: new Date(event.openedAt),
  state: event.state,
  closedAt: dateOf(event.closedAt),
  updatedAt: new Date(event.updatedAt),
  readyForReviewAt: dateOf(event.readyForReviewAt),
  draftPeriods: event.draftPeriods.map((each) => ({
    from: new Date(each.from),
    to: dateOf(each.to),
  })),
  firstReviewAt: dateOf(event.firstReviewAt),
  firstUnblockingReviewAt: dateOf(event.firstUnblockingReviewAt),
  firstApprovedAt: dateOf(event.firstApprovedAt),
  humanReviewedAt: event.humanReviewedAt.map((each) => new Date(each)),
  reviews: event.reviews,
  reviewRounds: event.reviewRounds,
  reviewComments: event.reviewComments,
  botActivity: event.botActivity,
  isRevert: event.isRevert,
  revertedBy: event.revertedBy,
  version: event.version,
});

export const insightsSubscribers = (
  handlers: InsightsHandlers,
): readonly DomainEventSubscriber[] => [
  subscribing<RunEndedIntegrationEvent>(
    'insights.record-ended-run',
    [RUN_ENDED],
    (event) =>
      event.taskId && event.stationId
        ? handlers.ending.ended(event)
        : Promise.resolve(),
  ),
  subscribing<RunEndedIntegrationEvent>(
    'insights.judge-ended-run',
    [RUN_ENDED],
    (event) =>
      event.taskId && event.stationId
        ? handlers.judging.runEnded(event)
        : Promise.resolve(),
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
  subscribing<RunRecordEnriched>(
    'insights.watch-station-after-enriched-run',
    ['run-record.enriched'],
    (event) => handlers.watching.runEnriched(event),
  ),
  subscribing<TaskPullRequestClosed>(
    'insights.watch-stations-after-closed-pull-request',
    ['task-pull-request.closed'],
    (event) => handlers.watching.pullRequestClosed(event),
  ),
  subscribing<StationAlertFired | StationAlertResolved | StationAlertReopened>(
    'insights.follow-station-alert-aside',
    ['station-alert.fired', 'station-alert.resolved', 'station-alert.reopened'],
    (event) => handlers.alerting.moved(event),
  ),
  subscribing<LineChangedIntegrationEvent>(
    'insights.watch-stations-after-line-changed',
    [LINE_CHANGED],
    (event) => handlers.watching.lineChanged(event),
  ),
  subscribing<RunSupersededIntegrationEvent>(
    'insights.record-superseded-run',
    [RUN_SUPERSEDED],
    (event) =>
      event.taskId
        ? handlers.superseding.superseded(
            RunId.of(event.runId),
            WorkspaceId.of(event.workspaceId),
            TaskId.of(event.taskId),
          )
        : Promise.resolve(),
  ),
  subscribing<ChangeCheckedIntegrationEvent>(
    'insights.record-checked-change',
    [CHANGE_CHECKED],
    (event) =>
      event.taskId
        ? handlers.checking.checked(
            RunId.of(event.runId),
            WorkspaceId.of(event.workspaceId),
            TaskId.of(event.taskId),
            event.passed,
          )
        : Promise.resolve(),
  ),
  subscribing<TaskActedOnIntegrationEvent>(
    'insights.record-first-human-action',
    [TASK_ACTED_ON],
    (event) => handlers.acting.acted(event),
  ),
  subscribing<PullRequestOpenedIntegrationEvent>(
    'insights.record-opened-pull-request',
    [PULL_REQUEST_OPENED],
    (event) =>
      handlers.opening.opened({
        taskId: TaskId.of(event.taskId),
        workspaceId: WorkspaceId.of(event.workspaceId),
        teamId: TeamId.of(event.teamId),
        pullRequest: PullRequestUrl.of(event.url),
        at: new Date(event.at),
      }),
  ),
  subscribing<PullRequestReviewedIntegrationEvent>(
    'insights.record-first-review',
    [PULL_REQUEST_REVIEWED],
    (event) =>
      handlers.reviewing.reviewed({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        byBot: event.byBot,
        at: event.submittedAt ? new Date(event.submittedAt) : null,
      }),
  ),
  subscribing<RunUsageRecordedIntegrationEvent>(
    'insights.record-run-usage',
    [RUN_USAGE_RECORDED],
    (event) =>
      event.taskId
        ? handlers.recordingUsage.usageRecorded(event)
        : Promise.resolve(),
  ),
  subscribing<MemoriesUsedIntegrationEvent>(
    'insights.record-run-memories',
    [MEMORIES_USED],
    (event) =>
      event.taskId && isMemoryVia(event.via)
        ? handlers.remembering.used({
            ...event,
            taskId: event.taskId,
            via: event.via,
          })
        : Promise.resolve(),
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
  subscribing<PullRequestClosedIntegrationEvent>(
    'insights.record-closed-pull-request',
    [PULL_REQUEST_CLOSED],
    (event) =>
      handlers.closing.closed({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        merged: event.merged,
        at: event.closedAt ? new Date(event.closedAt) : null,
      }),
  ),
  subscribing<PullRequestUpdatedIntegrationEvent>(
    'insights.record-seen-pull-request',
    [PULL_REQUEST_UPDATED],
    (event) =>
      handlers.recording.seen({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        seen: seenOf(event),
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
      }),
  ),
  subscribing<ChangeStackReadyIntegrationEvent>(
    'insights.record-change-shape',
    [CHANGE_STACK_READY],
    (event) =>
      event.taskId
        ? handlers.shaping.shaped({
            runId: event.runId,
            taskId: event.taskId,
            workspaceId: event.workspaceId,
            shape: {
              changeTitles: event.changeTitles,
              changeIntents: event.changeIntents,
              at: new Date(event.at),
            },
          })
        : Promise.resolve(),
  ),
  subscribing<ConfigPullRequestOpenedIntegrationEvent>(
    'insights.record-opened-config-pull-request',
    [CONFIG_PULL_REQUEST_OPENED],
    (event) =>
      handlers.openingConfigPullRequests.opened({
        configPullRequestId: event.configPullRequestId,
        workspaceId: WorkspaceId.of(event.workspaceId),
        teamId: TeamId.of(event.teamId),
        stationId: event.stationId,
        fingerprint: event.fingerprint,
        url: PullRequestUrl.of(event.url),
        openedAt: new Date(event.at),
      }),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'insights.delete-config-pull-requests-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      handlers.deleting.configPullRequestsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'insights.delete-config-pull-requests-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      handlers.deleting.configPullRequestsOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'insights.delete-pull-requests-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      handlers.deleting.pullRequestsOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'insights.delete-pull-requests-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      handlers.deleting.pullRequestsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'insights.delete-pull-requests-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      handlers.deleting.pullRequestsOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'insights.delete-runs-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      handlers.deleting.runsOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'insights.delete-task-pull-request-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      handlers.deleting.taskPullRequestOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'insights.delete-judgings-and-scores-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      handlers.deleting.judgingsAndScoresOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'insights.delete-human-actions-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      handlers.deleting.humanActionsOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'insights.delete-failures-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      handlers.deleting.failuresOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'insights.delete-alerts-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      handlers.deleting.alertsOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'insights.delete-alerts-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      handlers.deleting.alertsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'insights.delete-human-actions-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      handlers.deleting.humanActionsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'insights.delete-chats-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      handlers.deleting.chatsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'insights.delete-judgings-and-scores-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      handlers.deleting.judgingsAndScoresOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'insights.delete-failures-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      handlers.deleting.failuresOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'insights.delete-task-pull-requests-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      handlers.deleting.taskPullRequestsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'insights.delete-runs-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      handlers.deleting.runsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'insights.delete-runs-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      handlers.deleting.runsOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'insights.delete-task-pull-requests-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      handlers.deleting.taskPullRequestsOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'insights.delete-judgings-and-scores-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      handlers.deleting.judgingsAndScoresOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'insights.delete-human-actions-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      handlers.deleting.humanActionsOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'insights.delete-failures-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      handlers.deleting.failuresOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'insights.delete-chats-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      handlers.deleting.chatsOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'insights.delete-alerts-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      handlers.deleting.alertsOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
];
