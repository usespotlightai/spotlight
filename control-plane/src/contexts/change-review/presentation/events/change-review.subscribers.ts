import type { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import type { DecisionReactions } from '@change-review/application/events/handlers/decision-reactions.handler';
import type { ReviewReactions } from '@change-review/application/events/handlers/review-reactions.handler';
import type { StackCheckReactions } from '@change-review/application/events/handlers/stack-check-reactions.handler';
import type { ChangeStackAnnouncerPort } from '@change-review/application/ports/change-stack-announcer.port';
import type { CheckRunnersPort } from '@change-review/application/ports/check-runners.port';
import type { ApplyPullRequestClose } from '@change-review/application/services/apply-pull-request-close.service';
import type { AskForDecisions } from '@change-review/application/services/ask-for-decisions.service';
import type { DeleteTaskAcrossAggregates } from '@change-review/application/services/delete-task-across-aggregates.service';
import type { ReceiveReviewComment } from '@change-review/application/services/receive-review-comment.service';
import type { SignalReviewing } from '@change-review/application/services/signal-reviewing.service';
import type { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import type { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import type { ChangeStackReordered } from '@change-review/domain/events/change-stack-reordered.event';
import type { ChangeStackReorderingEnded } from '@change-review/domain/events/change-stack-reordering-ended.event';
import type { CheckReservationDropped } from '@change-review/domain/events/check-reservation-dropped.event';
import type { DecisionDisputed } from '@change-review/domain/events/decision-disputed.event';
import type { DecisionsRecorded } from '@change-review/domain/events/decisions-recorded.event';
import type { LayersFailedCheck } from '@change-review/domain/events/layers-failed-check.event';
import type { LeasedCheckDeleted } from '@change-review/domain/events/leased-check-deleted.event';
import type { ReviewCommentNotPosted } from '@change-review/domain/events/review-comment-not-posted.event';
import type { ReviewCommentPlaced } from '@change-review/domain/events/review-comment-placed.event';
import type { ReviewCommentRemoved } from '@change-review/domain/events/review-comment-removed.event';
import type { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import type { ReviewCommentRewritten } from '@change-review/domain/events/review-comment-rewritten.event';
import type { ReviewPosted } from '@change-review/domain/events/review-posted.event';
import type { ReviewSubmitted } from '@change-review/domain/events/review-submitted.event';
import {
  PULL_REQUEST_CLOSED,
  type PullRequestClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import {
  PULL_REQUEST_OPENED,
  type PullRequestOpenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-opened.integration-event';
import {
  REVIEW_COMMENT_RECEIVED,
  type ReviewCommentReceivedIntegrationEvent,
} from '@shared-kernel/application/integration-events/review-comment-received.integration-event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import {
  TASK_DISPATCHED,
  type TaskDispatchedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-dispatched.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const changeReviewSubscribers = (
  reactions: ChangeStackReactions,
  announcer: ChangeStackAnnouncerPort,
  deleting: DeleteTaskAcrossAggregates,
  reviews: ReviewReactions,
  receiving: ReceiveReviewComment,
  signalling: SignalReviewing,
  checks: StackCheckReactions,
  deciding: AskForDecisions,
  pullRequestClose: ApplyPullRequestClose,
  decisions: DecisionReactions,
  runners: CheckRunnersPort,
): readonly DomainEventSubscriber[] => [
  subscribing<ChangeStackChecked | LayersFailedCheck>(
    'change-review.release-runner-of-checked-stack',
    ['change-stack.checked', 'change-stack.layers-failed-check'],
    (event) => runners.released(event.stackId),
  ),
  subscribing<LeasedCheckDeleted>(
    'change-review.release-runner-of-deleted-check',
    ['change-stack.leased-check-deleted'],
    (event) => runners.released(event.stackId),
  ),
  subscribing<CheckReservationDropped>(
    'change-review.release-reserved-runner',
    ['change-stack.check-reservation-dropped'],
    (event) => runners.reservationDropped(event.runner),
  ),
  subscribing<ChangeStackCompleted>(
    'change-review.begin-check',
    ['change-stack.completed'],
    (event) => checks.onCompleted(event),
  ),
  subscribing<LayersFailedCheck>(
    'change-review.ask-to-reorder',
    ['change-stack.layers-failed-check'],
    (event) => checks.onLayersFailed(event.stackId),
  ),
  subscribing<ChangeStackReordered>(
    'change-review.take-reordered-layers',
    ['change-stack.reordered'],
    (event) => checks.onReordered(event.stackId),
  ),
  subscribing<ChangeStackReorderingEnded>(
    'change-review.keep-checked-layers',
    ['change-stack.reordering-ended'],
    (event) => checks.onReorderingEnded(event.stackId),
  ),
  subscribing<TaskDispatchedIntegrationEvent>(
    'change-review.signal-reviewing',
    [TASK_DISPATCHED],
    (event) => signalling.began(TaskId.of(event.taskId), RunId.of(event.runId)),
  ),
  subscribing<RunEndedIntegrationEvent>(
    'change-review.signal-reviewed',
    [RUN_ENDED],
    (event) =>
      event.taskId
        ? signalling.ended(TaskId.of(event.taskId), RunId.of(event.runId))
        : Promise.resolve(),
  ),
  subscribing<RunEndedIntegrationEvent>(
    'change-review.ask-for-decisions',
    [RUN_ENDED],
    (event) =>
      event.taskId
        ? deciding.runEnded(TaskId.of(event.taskId), RunId.of(event.runId))
        : Promise.resolve(),
  ),
  subscribing<PullRequestClosedIntegrationEvent>(
    'change-review.apply-pull-request-close',
    [PULL_REQUEST_CLOSED],
    (event) =>
      pullRequestClose.closed({
        workspaceId: WorkspaceId.of(event.workspaceId),
        pullRequest: PullRequestUrl.of(event.pullRequest),
        repository: Repository.of(event.repository),
        merge: event.merged ? { commit: event.mergeCommit } : null,
        closedAt: event.closedAt ? new Date(event.closedAt) : null,
      }),
  ),
  subscribing<ChangeStackCompleted>(
    'change-review.announce-completed',
    ['change-stack.completed'],
    (event) => reactions.onCompleted(event),
  ),
  subscribing<ChangeStackChecked>(
    'change-review.announce-checked',
    ['change-stack.checked'],
    (event) => reactions.onChecked(event),
  ),
  subscribing<PullRequestOpenedIntegrationEvent>(
    'change-review.announce-pull-request',
    [PULL_REQUEST_OPENED],
    (event) => announcer.ofTask(TaskId.of(event.taskId)),
  ),
  subscribing<DecisionsRecorded>(
    'change-review.announce-decisions',
    ['decisions.recorded'],
    (event) => decisions.onRecorded(event),
  ),
  subscribing<DecisionDisputed>(
    'change-review.announce-disputed-decision',
    ['decisions.disputed'],
    (event) => decisions.onDisputed(event),
  ),
  subscribing<PullRequestOpenedIntegrationEvent>(
    'change-review.announce-decisions-on-open',
    [PULL_REQUEST_OPENED],
    (event) => decisions.onPullRequestOpened(TaskId.of(event.taskId)),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'change-review.delete-task',
    [TASK_DELETED],
    (event) => deleting.deleteTask(TaskId.of(event.taskId)),
  ),
  subscribing<ReviewSubmitted>(
    'change-review.post-review',
    ['review.submitted'],
    (event) => reviews.onSubmitted(event),
  ),
  subscribing<ReviewPosted>(
    'change-review.post-file-comments',
    ['review.posted'],
    (event) => reviews.onPosted(event),
  ),
  subscribing<ReviewCommentPlaced>(
    'change-review.keep-posted-comment',
    ['review.comment-placed'],
    (event) => reviews.onCommentPlaced(event),
  ),
  subscribing<ReviewCommentNotPosted>(
    'change-review.record-unposted-comment',
    ['review.comment-not-posted'],
    (event) => reviews.onCommentNotPosted(event),
  ),
  subscribing<ReviewCommentReplied>(
    'change-review.post-reply',
    ['review-comment.replied'],
    (event) => reviews.onReplied(event),
  ),
  subscribing<ReviewCommentRewritten>(
    'change-review.edit-on-github',
    ['review-comment.rewritten'],
    (event) => reviews.onRewritten(event),
  ),
  subscribing<ReviewCommentRemoved>(
    'change-review.delete-on-github',
    ['review-comment.removed'],
    (event) => reviews.onRemoved(event),
  ),
  subscribing<ReviewCommentReceivedIntegrationEvent>(
    'change-review.receive-review-comment',
    [REVIEW_COMMENT_RECEIVED],
    (event) =>
      receiving.receive({
        workspaceId: WorkspaceId.of(event.workspaceId),
        action: event.action,
        pullRequest: event.pullRequest,
        comment: {
          id: event.commentId,
          url: event.url,
          path: event.path,
          ...(event.subject === 'file'
            ? { subject: 'file' as const }
            : {
                subject: 'line' as const,
                side: event.side,
                line: event.line,
                startLine: event.startLine,
              }),
          body: event.body,
          answers: event.answers,
          login: event.login,
          writtenAt: event.writtenAt ? new Date(event.writtenAt) : null,
        },
      }),
  ),
];
