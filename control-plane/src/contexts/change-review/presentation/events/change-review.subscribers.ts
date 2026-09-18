import type { ChangeStackReactions } from '@change-review/application/events/handlers/change-stack-reactions.handler';
import type { ReviewReactions } from '@change-review/application/events/handlers/review-reactions.handler';
import type { ChangeStackAnnouncerPort } from '@change-review/application/ports/change-stack-announcer.port';
import type { ForgetTaskAcrossAggregates } from '@change-review/application/services/forget-task-across-aggregates.service';
import type { ReceiveReviewComment } from '@change-review/application/services/receive-review-comment.service';
import type { SignalReviewing } from '@change-review/application/services/signal-reviewing.service';
import type { ChangeStackChecked } from '@change-review/domain/events/change-stack-checked.event';
import type { ChangeStackSettled } from '@change-review/domain/events/change-stack-settled.event';
import type { ReviewCommentRemoved } from '@change-review/domain/events/review-comment-removed.event';
import type { ReviewCommentReplied } from '@change-review/domain/events/review-comment-replied.event';
import type { ReviewCommentRewritten } from '@change-review/domain/events/review-comment-rewritten.event';
import type { ReviewNotPosted } from '@change-review/domain/events/review-not-posted.event';
import type { ReviewPosted } from '@change-review/domain/events/review-posted.event';
import type { ReviewSubmitted } from '@change-review/domain/events/review-submitted.event';
import {
  REVIEW_COMMENT_RECEIVED,
  type ReviewCommentReceivedIntegrationEvent,
} from '@github/application/integration-events/review-comment-received.integration-event';
import {
  type DomainEventSubscriber,
  subscribing,
} from '@shared-kernel/application/ports/domain-event-subscriber.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  PULL_REQUEST_OPENED,
  type PullRequestOpenedIntegrationEvent,
} from '@work/application/integration-events/pull-request-opened.integration-event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@work/application/integration-events/run-ended.integration-event';
import {
  TASK_DELETED,
  type TaskDeletedIntegrationEvent,
} from '@work/application/integration-events/task-deleted.integration-event';
import {
  TASK_HANDED_TO_RUN,
  type TaskHandedToRunIntegrationEvent,
} from '@work/application/integration-events/task-handed-to-run.integration-event';

export const changeReviewSubscribers = (
  reactions: ChangeStackReactions,
  announcer: ChangeStackAnnouncerPort,
  forgetting: ForgetTaskAcrossAggregates,
  reviews: ReviewReactions,
  receiving: ReceiveReviewComment,
  signalling: SignalReviewing,
): readonly DomainEventSubscriber[] => [
  subscribing<TaskHandedToRunIntegrationEvent>(
    'change-review.signal-reviewing',
    [TASK_HANDED_TO_RUN],
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
  subscribing<ChangeStackSettled>(
    'change-review.announce-settled',
    ['change-stack.settled'],
    (event) => reactions.onSettled(event),
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
  subscribing<TaskDeletedIntegrationEvent>(
    'change-review.forget-task',
    [TASK_DELETED],
    (event) => forgetting.forget(TaskId.of(event.taskId)),
  ),
  subscribing<ReviewSubmitted>(
    'change-review.post-review',
    ['review.submitted'],
    (event) => reviews.onSubmitted(event),
  ),
  subscribing<ReviewPosted>(
    'change-review.keep-posted-comments',
    ['review.posted'],
    (event) => reviews.onPosted(event),
  ),
  subscribing<ReviewNotPosted>(
    'change-review.settle-unposted-comments',
    ['review.not-posted'],
    (event) => reviews.onNotPosted(event),
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
          side: event.side,
          line: event.line,
          startLine: event.startLine,
          body: event.body,
          answers: event.answers,
          login: event.login,
          writtenAt: event.writtenAt ? new Date(event.writtenAt) : null,
        },
      }),
  ),
];
