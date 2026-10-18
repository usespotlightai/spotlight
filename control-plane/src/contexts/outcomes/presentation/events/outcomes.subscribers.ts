import type { AlertInbox } from '@outcomes/application/services/alert-inbox.service';
import type { DeleteOutcomes } from '@outcomes/application/services/delete-outcomes.service';
import type { GradeAsides } from '@outcomes/application/services/grade-asides.service';
import type { NoteChangeChecked } from '@outcomes/application/services/note-change-checked.service';
import type { NoteChangeShaped } from '@outcomes/application/services/note-change-shaped.service';
import type { NoteChatStarted } from '@outcomes/application/services/note-chat-started.service';
import type { NoteConfigPullRequestOpened } from '@outcomes/application/services/note-config-pull-request-opened.service';
import type { NotePersonAct } from '@outcomes/application/services/note-person-act.service';
import type { NotePullRequestClosed } from '@outcomes/application/services/note-pull-request-closed.service';
import type { NotePullRequestOpened } from '@outcomes/application/services/note-pull-request-opened.service';
import type { NotePullRequestRecords } from '@outcomes/application/services/note-pull-request-records.service';
import type { NotePullRequestReviewed } from '@outcomes/application/services/note-pull-request-reviewed.service';
import type { NoteRunDigested } from '@outcomes/application/services/note-run-digested.service';
import type { NoteRunEnded } from '@outcomes/application/services/note-run-ended.service';
import type { NoteRunMemories } from '@outcomes/application/services/note-run-memories.service';
import type { NoteRunPassed } from '@outcomes/application/services/note-run-passed.service';
import type { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import type { NoteTaskFailed } from '@outcomes/application/services/note-task-failed.service';
import type { NoteTaskTouch } from '@outcomes/application/services/note-task-touch.service';
import type { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import type { RequestJudging } from '@outcomes/application/services/request-judging.service';
import type { WatchStations } from '@outcomes/application/services/watch-stations.service';
import type { RunJudged } from '@outcomes/domain/events/run-judged.event';
import type { RunRecordEnded } from '@outcomes/domain/events/run-record-ended.event';
import type { RunRecordEnriched } from '@outcomes/domain/events/run-record-enriched.event';
import type { ScoreRecorded } from '@outcomes/domain/events/score-recorded.event';
import type { StationAlertRaised } from '@outcomes/domain/events/station-alert-raised.event';
import type { StationAlertRecovered } from '@outcomes/domain/events/station-alert-recovered.event';
import type { StationAlertReopened } from '@outcomes/domain/events/station-alert-reopened.event';
import type { TaskDeliveryClosed } from '@outcomes/domain/events/task-delivery-closed.event';
import { isMemoryWay } from '@outcomes/domain/value-objects/run-memories.vo';
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
  RUN_DIGESTED,
  type RunDigestedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-digested.integration-event';
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

export interface OutcomesReactions {
  readonly ending: NoteRunEnded;
  readonly superseding: NoteRunSuperseded;
  readonly checking: NoteChangeChecked;
  readonly acting: NotePersonAct;
  readonly opening: NotePullRequestOpened;
  readonly closing: NotePullRequestClosed;
  readonly deleting: DeleteOutcomes;
  readonly judging: RequestJudging;
  readonly scoring: RecordJudgeScore;
  readonly grading: GradeAsides;
  readonly digesting: NoteRunDigested;
  readonly remembering: NoteRunMemories;
  readonly passing: NoteRunPassed;
  readonly reviewing: NotePullRequestReviewed;
  readonly failing: NoteTaskFailed;
  readonly touching: NoteTaskTouch;
  readonly chatting: NoteChatStarted;
  readonly recording: NotePullRequestRecords;
  readonly shaping: NoteChangeShaped;
  readonly watching: WatchStations;
  readonly alerting: AlertInbox;
  readonly openingConfigPullRequests: NoteConfigPullRequestOpened;
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
    'outcomes.ask-or-resolve-grade',
    ['score.recorded'],
    (event) => reactions.grading.recorded(event),
  ),
  subscribing<RunRecordEnded>(
    'outcomes.watch-station-after-run',
    ['run-record.ended'],
    (event) => reactions.watching.runEnded(event),
  ),
  subscribing<RunRecordEnriched>(
    'outcomes.watch-station-after-enriched-run',
    ['run-record.enriched'],
    (event) => reactions.watching.runEnriched(event),
  ),
  subscribing<TaskDeliveryClosed>(
    'outcomes.watch-stations-after-closed-delivery',
    ['task-delivery.closed'],
    (event) => reactions.watching.deliveryClosed(event),
  ),
  subscribing<
    StationAlertRaised | StationAlertRecovered | StationAlertReopened
  >(
    'outcomes.follow-station-alert-aside',
    [
      'station-alert.raised',
      'station-alert.recovered',
      'station-alert.reopened',
    ],
    (event) => reactions.alerting.moved(event),
  ),
  subscribing<LineChangedIntegrationEvent>(
    'outcomes.watch-stations-after-line-changed',
    [LINE_CHANGED],
    (event) => reactions.watching.lineChanged(event),
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
      event.taskId
        ? reactions.checking.checked(
            RunId.of(event.runId),
            WorkspaceId.of(event.workspaceId),
            TaskId.of(event.taskId),
            event.passed,
          )
        : Promise.resolve(),
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
      reactions.opening.opened({
        taskId: TaskId.of(event.taskId),
        workspaceId: WorkspaceId.of(event.workspaceId),
        teamId: TeamId.of(event.teamId),
        pullRequest: PullRequestUrl.of(event.url),
        at: new Date(event.at),
      }),
  ),
  subscribing<PullRequestReviewedIntegrationEvent>(
    'outcomes.record-first-review',
    [PULL_REQUEST_REVIEWED],
    (event) =>
      reactions.reviewing.reviewed({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        byBot: event.byBot,
        at: event.submittedAt ? new Date(event.submittedAt) : null,
      }),
  ),
  subscribing<RunDigestedIntegrationEvent>(
    'outcomes.record-run-cost',
    [RUN_DIGESTED],
    (event) =>
      event.taskId ? reactions.digesting.digested(event) : Promise.resolve(),
  ),
  subscribing<MemoriesUsedIntegrationEvent>(
    'outcomes.record-run-memories',
    [MEMORIES_USED],
    (event) =>
      event.taskId && isMemoryWay(event.way)
        ? reactions.remembering.used({
            ...event,
            taskId: event.taskId,
            way: event.way,
          })
        : Promise.resolve(),
  ),
  subscribing<TaskPassedIntegrationEvent>(
    'outcomes.record-passed-run',
    [TASK_PASSED],
    (event) => reactions.passing.passed(event),
  ),
  subscribing<TaskFailedIntegrationEvent>(
    'outcomes.record-task-failure',
    [TASK_FAILED],
    (event) => reactions.failing.failed(event),
  ),
  subscribing<TaskOpenedIntegrationEvent>(
    'outcomes.record-task-opening',
    [TASK_OPENED],
    (event) => reactions.touching.opened(event),
  ),
  subscribing<TaskAskedIntegrationEvent>(
    'outcomes.record-inbox-ask',
    [TASK_ASKED],
    (event) => reactions.touching.asked(event),
  ),
  subscribing<TaskActedOnIntegrationEvent>(
    'outcomes.record-person-touch',
    [TASK_ACTED_ON],
    (event) => reactions.touching.acted(event),
  ),
  subscribing<ChatStartedIntegrationEvent>(
    'outcomes.record-started-chat',
    [CHAT_STARTED],
    (event) => reactions.chatting.started(event),
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
  subscribing<PullRequestUpdatedIntegrationEvent>(
    'outcomes.record-seen-pull-request',
    [PULL_REQUEST_UPDATED],
    (event) =>
      reactions.recording.seen({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        seen: seenOf(event),
      }),
  ),
  subscribing<PullRequestPurgedIntegrationEvent>(
    'outcomes.delete-pull-request-purged-by-github',
    [PULL_REQUEST_PURGED],
    (event) =>
      reactions.recording.purgedByGitHub({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        updatedAt: new Date(event.updatedAt),
      }),
  ),
  subscribing<PullRequestOpenedIntegrationEvent>(
    'outcomes.record-pull-request-owner',
    [PULL_REQUEST_OPENED],
    (event) =>
      reactions.recording.owned({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.url),
        taskId: TaskId.of(event.taskId),
        teamId: TeamId.of(event.teamId),
      }),
  ),
  subscribing<PullRequestReviewTakenIntegrationEvent>(
    'outcomes.record-pull-request-review-task',
    [PULL_REQUEST_REVIEW_TAKEN],
    (event) =>
      reactions.recording.reviewed({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.url),
        taskId: TaskId.of(event.taskId),
      }),
  ),
  subscribing<ChangeStackReadyIntegrationEvent>(
    'outcomes.record-change-shape',
    [CHANGE_STACK_READY],
    (event) =>
      event.taskId
        ? reactions.shaping.shaped({
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
    'outcomes.record-opened-config-pull-request',
    [CONFIG_PULL_REQUEST_OPENED],
    (event) =>
      reactions.openingConfigPullRequests.opened({
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
    'outcomes.delete-config-pull-requests-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deleting.configPullRequestsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'outcomes.delete-config-pull-requests-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.configPullRequestsOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.delete-pull-requests-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.deleting.pullRequestsOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'outcomes.delete-pull-requests-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deleting.pullRequestsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'outcomes.delete-pull-requests-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.pullRequestsOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.delete-runs-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.deleting.runsOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.delete-delivery-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.deleting.deliveryOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.delete-judgings-and-scores-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.deleting.judgingsAndScoresOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.delete-touches-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.deleting.touchesOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.delete-failures-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.deleting.failuresOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.delete-alerts-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.deleting.alertsOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'outcomes.delete-alerts-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deleting.alertsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'outcomes.delete-touches-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deleting.touchesOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'outcomes.delete-chats-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deleting.chatsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'outcomes.delete-judgings-and-scores-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deleting.judgingsAndScoresOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'outcomes.delete-failures-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deleting.failuresOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'outcomes.delete-deliveries-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deleting.deliveriesOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'outcomes.delete-runs-of-deleted-team',
    [TEAM_DELETED],
    (event) =>
      reactions.deleting.runsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'outcomes.delete-runs-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.runsOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'outcomes.delete-deliveries-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.deliveriesOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'outcomes.delete-judgings-and-scores-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.judgingsAndScoresOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'outcomes.delete-touches-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.touchesOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'outcomes.delete-failures-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.failuresOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'outcomes.delete-chats-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.chatsOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceDeletedIntegrationEvent>(
    'outcomes.delete-alerts-of-deleted-workspace',
    [WORKSPACE_DELETED],
    (event) =>
      reactions.deleting.alertsOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
];
