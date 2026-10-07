import type { AlertInbox } from '@outcomes/application/services/alert-inbox.service';
import type { AskForJudging } from '@outcomes/application/services/ask-for-judging.service';
import type { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
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
import type { NoteRunHandedOn } from '@outcomes/application/services/note-run-handed-on.service';
import type { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import type { NoteTaskFailed } from '@outcomes/application/services/note-task-failed.service';
import type { NoteTaskTouch } from '@outcomes/application/services/note-task-touch.service';
import type { RecordJudgeScore } from '@outcomes/application/services/record-judge-score.service';
import type { WatchStations } from '@outcomes/application/services/watch-stations.service';
import type { RunJudged } from '@outcomes/domain/events/run-judged.event';
import type { RunRecordEnded } from '@outcomes/domain/events/run-record-ended.event';
import type { RunRecordSettled } from '@outcomes/domain/events/run-record-settled.event';
import type { ScoreRecorded } from '@outcomes/domain/events/score-recorded.event';
import type { StationAlertRaised } from '@outcomes/domain/events/station-alert-raised.event';
import type { StationAlertRecovered } from '@outcomes/domain/events/station-alert-recovered.event';
import type { StationAlertReopened } from '@outcomes/domain/events/station-alert-reopened.event';
import type { TaskDeliveryClosed } from '@outcomes/domain/events/task-delivery-closed.event';
import {
  CHANGE_CHECKED,
  type ChangeCheckedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-checked.integration-event';
import {
  CHANGE_STACK_SHAPED,
  type ChangeStackShapedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-stack-shaped.integration-event';
import {
  CHAT_STARTED,
  type ChatStartedIntegrationEvent,
} from '@shared-kernel/application/integration-events/chat-started.integration-event';
import {
  CONFIG_PULL_REQUEST_OPENED,
  type ConfigPullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/config-pull-request-opened.integration-event';
import {
  LINE_REDEFINED,
  type LineRedefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/line-redefined.integration-event';
import {
  PULL_REQUEST_CLOSED,
  type PullRequestClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import {
  PULL_REQUEST_FORGOTTEN,
  type PullRequestForgottenIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-forgotten.integration-event';
import {
  PULL_REQUEST_OPENED,
  type PullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import {
  PULL_REQUEST_RECORDED,
  type PullRequestRecordedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-recorded.integration-event';
import {
  PULL_REQUEST_REVIEW_TAKEN,
  type PullRequestReviewTakenIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-review-taken.integration-event';
import {
  PULL_REQUEST_REVIEWED,
  type PullRequestReviewedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-reviewed.integration-event';
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
  TASK_HANDED_ON,
  type TaskHandedOnIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-handed-on.integration-event';
import {
  TASK_OPENED,
  type TaskOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-opened.integration-event';
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
  readonly digesting: NoteRunDigested;
  readonly handingOn: NoteRunHandedOn;
  readonly reviewing: NotePullRequestReviewed;
  readonly failing: NoteTaskFailed;
  readonly touching: NoteTaskTouch;
  readonly chatting: NoteChatStarted;
  readonly recording: NotePullRequestRecords;
  readonly shaping: NoteChangeShaped;
  readonly watching: WatchStations;
  readonly alerting: AlertInbox;
  readonly proposing: NoteConfigPullRequestOpened;
}

const dateOf = (at: string | null): Date | null => (at ? new Date(at) : null);

const seenOf = (event: PullRequestRecordedIntegrationEvent) => ({
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
  draftSpells: event.draftSpells.map((each) => ({
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
    'outcomes.ask-or-settle-grade',
    ['score.recorded'],
    (event) => reactions.grading.recorded(event),
  ),
  subscribing<RunRecordEnded>(
    'outcomes.watch-station-after-run',
    ['run-record.ended'],
    (event) => reactions.watching.runEnded(event),
  ),
  subscribing<RunRecordSettled>(
    'outcomes.watch-station-after-settled-run',
    ['run-record.settled'],
    (event) => reactions.watching.runSettled(event),
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
  subscribing<LineRedefinedIntegrationEvent>(
    'outcomes.watch-stations-after-line-redefined',
    [LINE_REDEFINED],
    (event) => reactions.watching.lineRedefined(event),
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
  subscribing<TaskHandedOnIntegrationEvent>(
    'outcomes.record-handed-on-run',
    [TASK_HANDED_ON],
    (event) => reactions.handingOn.handedOn(event),
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
  subscribing<PullRequestRecordedIntegrationEvent>(
    'outcomes.record-seen-pull-request',
    [PULL_REQUEST_RECORDED],
    (event) =>
      reactions.recording.seen({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        seen: seenOf(event),
      }),
  ),
  subscribing<PullRequestForgottenIntegrationEvent>(
    'outcomes.forget-pull-request-github-forgot',
    [PULL_REQUEST_FORGOTTEN],
    (event) =>
      reactions.recording.forgottenByGitHub({
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
  subscribing<ChangeStackShapedIntegrationEvent>(
    'outcomes.record-change-shape',
    [CHANGE_STACK_SHAPED],
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
      reactions.proposing.opened({
        configPullRequestId: event.configPullRequestId,
        workspaceId: WorkspaceId.of(event.workspaceId),
        teamId: TeamId.of(event.teamId),
        lineId: event.lineId,
        stationId: event.stationId,
        fingerprint: event.fingerprint,
        url: PullRequestUrl.of(event.url),
        openedAt: new Date(event.openedAt),
      }),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'outcomes.forget-config-pull-requests-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.forgetting.configPullRequestsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'outcomes.forget-config-pull-requests-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.forgetting.configPullRequestsOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.forget-pull-requests-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.forgetting.pullRequestsOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'outcomes.forget-pull-requests-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.forgetting.pullRequestsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'outcomes.forget-pull-requests-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.forgetting.pullRequestsOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.forget-runs-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.forgetting.runsOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.forget-delivery-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.forgetting.deliveryOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.forget-judgings-and-scores-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.forgetting.judgingsAndScoresOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.forget-touches-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.forgetting.touchesOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.forget-failures-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.forgetting.failuresOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'outcomes.forget-alerts-of-deleted-task',
    [TASK_DELETED],
    (event) =>
      reactions.forgetting.alertsOfTask(
        WorkspaceId.of(event.workspaceId),
        TaskId.of(event.taskId),
      ),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'outcomes.forget-alerts-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.forgetting.alertsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'outcomes.forget-touches-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.forgetting.touchesOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'outcomes.forget-chats-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.forgetting.chatsOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
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
    'outcomes.forget-failures-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.forgetting.failuresOfTeam(
        WorkspaceId.of(event.workspaceId),
        TeamId.of(event.teamId),
      ),
  ),
  subscribing<TeamDisbandedIntegrationEvent>(
    'outcomes.forget-deliveries-of-disbanded-team',
    [TEAM_DISBANDED],
    (event) =>
      reactions.forgetting.deliveriesOfTeam(
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
  subscribing<WorkspaceClosedIntegrationEvent>(
    'outcomes.forget-touches-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.forgetting.touchesOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'outcomes.forget-failures-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.forgetting.failuresOfWorkspace(
        WorkspaceId.of(event.workspaceId),
      ),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'outcomes.forget-chats-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.forgetting.chatsOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
  subscribing<WorkspaceClosedIntegrationEvent>(
    'outcomes.forget-alerts-of-closed-workspace',
    [WORKSPACE_CLOSED],
    (event) =>
      reactions.forgetting.alertsOfWorkspace(WorkspaceId.of(event.workspaceId)),
  ),
];
