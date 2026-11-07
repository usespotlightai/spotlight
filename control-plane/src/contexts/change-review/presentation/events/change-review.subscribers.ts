import type { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import type { DecisionReactions } from '@change-review/application/events/handlers/decision-reactions.handler';
import type { ReviewReactions } from '@change-review/application/events/handlers/review-reactions.handler';
import type { StackCheckReactions } from '@change-review/application/events/handlers/stack-check-reactions.handler';
import type { TaskDeletionReactions } from '@change-review/application/events/handlers/task-deletion-reactions.handler';
import type { TeamDeletionReactions } from '@change-review/application/events/handlers/team-deletion-reactions.handler';
import type { CheckRunnersPort } from '@change-review/application/ports/check-runners.port';
import type { StickyCommentPosterPort } from '@change-review/application/ports/sticky-comment-poster.port';
import type { ApplyPullRequestClose } from '@change-review/application/services/apply-pull-request-close.service';
import type { ReceiveReviewComment } from '@change-review/application/services/receive-review-comment.service';
import type { RequestDecisions } from '@change-review/application/services/request-decisions.service';
import type { SignalReviewing } from '@change-review/application/services/signal-reviewing.service';
import type { ChangeStackCompleted } from '@change-review/domain/events/change-stack-completed.event';
import type { ChangeStackRedrafted } from '@change-review/domain/events/change-stack-redrafted.event';
import type { ChangeStackRedraftingEnded } from '@change-review/domain/events/change-stack-redrafting-ended.event';
import type { DecisionDisputed } from '@change-review/domain/events/decision-disputed.event';
import type { DecisionsRecorded } from '@change-review/domain/events/decisions-recorded.event';
import type { IncludedCommentPosted } from '@change-review/domain/events/included-comment-posted.event';
import type { IncludedCommentReturned } from '@change-review/domain/events/included-comment-returned.event';
import type { LeasedStackCheckDeleted } from '@change-review/domain/events/leased-stack-check-deleted.event';
import type { ReviewCommentDeleted } from '@change-review/domain/events/review-comment-deleted.event';
import type { ReviewCommentEdited } from '@change-review/domain/events/review-comment-edited.event';
import type { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import type { ReviewPosted } from '@change-review/domain/events/review-posted.event';
import type { ReviewSubmitted } from '@change-review/domain/events/review-submitted.event';
import type { StackCheckLayersFailed } from '@change-review/domain/events/stack-check-layers-failed.event';
import type { StackCheckReservationDropped } from '@change-review/domain/events/stack-check-reservation-dropped.event';
import type { StackChecked } from '@change-review/domain/events/stack-checked.event';
import {
  DISPATCH_ENDED,
  type DispatchEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-ended.integration-event';
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
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-deleted.integration-event';
import {
  TASK_DISPATCHED,
  type TaskDispatchedIntegrationEvent,
} from '@shared-kernel/application/integration-events/task-dispatched.integration-event';
import {
  TEAM_DELETED,
  type TeamDeletedIntegrationEvent,
} from '@shared-kernel/application/integration-events/team-deleted.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const changeReviewSubscribers = (
  reactions: ChangeStackReactions,
  poster: StickyCommentPosterPort,
  deleting: TaskDeletionReactions,
  teamDeleting: TeamDeletionReactions,
  reviews: ReviewReactions,
  receiving: ReceiveReviewComment,
  signalling: SignalReviewing,
  checks: StackCheckReactions,
  deciding: RequestDecisions,
  pullRequestClose: ApplyPullRequestClose,
  decisions: DecisionReactions,
  runners: CheckRunnersPort,
): readonly DomainEventSubscriber[] => [
  subscribing<StackChecked | StackCheckLayersFailed>(
    'change-review.release-runner-of-checked-stack',
    ['stack-check.checked', 'stack-check.layers-failed'],
    (event) => runners.released(event.checkId.stackId),
  ),
  subscribing<LeasedStackCheckDeleted>(
    'change-review.release-runner-of-deleted-check',
    ['stack-check.leased-check-deleted'],
    (event) => runners.released(event.checkId.stackId),
  ),
  subscribing<StackCheckReservationDropped>(
    'change-review.release-reserved-runner',
    ['stack-check.reservation-dropped'],
    (event) => runners.reservationDropped(event.runner),
  ),
  subscribing<ChangeStackCompleted>(
    'change-review.begin-check',
    ['change-stack.completed'],
    (event) => checks.onCompleted(event),
  ),
  subscribing<StackCheckLayersFailed>(
    'change-review.request-redraft',
    ['stack-check.layers-failed'],
    (event) => checks.onLayersFailed(event.checkId.stackId),
  ),
  subscribing<ChangeStackRedrafted>(
    'change-review.take-redrafted-layers',
    ['change-stack.redrafted'],
    (event) => checks.onRedrafted(event.stackId),
  ),
  subscribing<ChangeStackRedraftingEnded>(
    'change-review.retain-checked-layers',
    ['change-stack.redrafting-ended'],
    (event) => checks.onRedraftingEnded(event.stackId),
  ),
  subscribing<TaskDispatchedIntegrationEvent>(
    'change-review.signal-reviewing',
    [TASK_DISPATCHED],
    (event) => signalling.began(TaskId.of(event.taskId), RunId.of(event.runId)),
    { callsOut: true },
  ),
  subscribing<DispatchEndedIntegrationEvent>(
    'change-review.signal-reviewed',
    [DISPATCH_ENDED],
    (event) =>
      event.taskId
        ? signalling.ended(TaskId.of(event.taskId), RunId.of(event.runId))
        : Promise.resolve(),
    { callsOut: true },
  ),
  subscribing<DispatchEndedIntegrationEvent>(
    'change-review.request-decisions',
    [DISPATCH_ENDED],
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
    'change-review.post-stack-comment-on-completed',
    ['change-stack.completed'],
    (event) => reactions.onCompleted(event),
    { callsOut: true },
  ),
  subscribing<StackChecked>(
    'change-review.post-stack-comment-on-checked',
    ['stack-check.checked'],
    (event) => reactions.onChecked(event),
    { callsOut: true },
  ),
  subscribing<PullRequestOpenedIntegrationEvent>(
    'change-review.post-stack-comment-on-pull-request',
    [PULL_REQUEST_OPENED],
    (event) => poster.ofTask(TaskId.of(event.taskId)),
    { callsOut: true },
  ),
  subscribing<DecisionsRecorded>(
    'change-review.post-decisions-comment',
    ['decision-set.recorded'],
    (event) => decisions.onRecorded(event),
    { callsOut: true },
  ),
  subscribing<DecisionDisputed>(
    'change-review.post-decisions-comment-on-dispute',
    ['decision-set.disputed'],
    (event) => decisions.onDisputed(event),
    { callsOut: true },
  ),
  subscribing<PullRequestOpenedIntegrationEvent>(
    'change-review.post-decisions-comment-on-open',
    [PULL_REQUEST_OPENED],
    (event) => decisions.onPullRequestOpened(TaskId.of(event.taskId)),
    { callsOut: true },
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'change-review.drop-deliveries-of-deleted-task',
    [TASK_DELETED],
    (event) => deleting.dropDeliveries(TaskId.of(event.taskId)),
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'change-review.remove-reviews-of-deleted-task',
    [TASK_DELETED],
    (event) => deleting.removeReviews(TaskId.of(event.taskId)),
    { callsOut: true },
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'change-review.remove-review-comments-of-deleted-task',
    [TASK_DELETED],
    (event) => deleting.removeComments(TaskId.of(event.taskId)),
    { callsOut: true },
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'change-review.remove-stack-checks-of-deleted-task',
    [TASK_DELETED],
    (event) => deleting.removeChecks(TaskId.of(event.taskId)),
    { callsOut: true },
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'change-review.remove-question-answers-of-deleted-task',
    [TASK_DELETED],
    (event) => deleting.removeAnswers(TaskId.of(event.taskId)),
    { callsOut: true },
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'change-review.remove-change-stacks-of-deleted-task',
    [TASK_DELETED],
    (event) => deleting.removeStacks(TaskId.of(event.taskId)),
    { callsOut: true },
  ),
  subscribing<TaskDeletedIntegrationEvent>(
    'change-review.remove-decision-sets-of-deleted-task',
    [TASK_DELETED],
    (event) => deleting.removeDecisions(TaskId.of(event.taskId)),
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'change-review.remove-stack-checks-of-deleted-team',
    [TEAM_DELETED],
    (event) => teamDeleting.removeChecks(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'change-review.remove-question-answers-of-deleted-team',
    [TEAM_DELETED],
    (event) => teamDeleting.removeAnswers(TeamId.of(event.teamId)),
    { callsOut: true },
  ),
  subscribing<TeamDeletedIntegrationEvent>(
    'change-review.remove-change-stacks-of-deleted-team',
    [TEAM_DELETED],
    (event) => teamDeleting.removeStacks(TeamId.of(event.teamId)),
    { callsOut: true },
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
  subscribing<IncludedCommentPosted>(
    'change-review.record-posted-comment',
    ['review.included-comment-posted'],
    (event) => reviews.onCommentPosted(event),
  ),
  subscribing<IncludedCommentReturned>(
    'change-review.return-comment-to-draft',
    ['review.included-comment-returned'],
    (event) => reviews.onCommentReturned(event),
  ),
  subscribing<ReviewCommentReplied>(
    'change-review.post-reply',
    ['review-comment.replied'],
    (event) => reviews.onReplied(event),
  ),
  subscribing<ReviewCommentEdited>(
    'change-review.edit-on-github',
    ['review-comment.edited'],
    (event) => reviews.onEdited(event),
  ),
  subscribing<ReviewCommentDeleted>(
    'change-review.delete-on-github',
    ['review-comment.deleted'],
    (event) => reviews.onDeleted(event),
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
          inReplyToId: event.inReplyToId,
          login: event.login,
          writtenAt: event.writtenAt ? new Date(event.writtenAt) : null,
        },
      }),
  ),
];
