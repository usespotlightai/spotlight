import type { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import type { PullRequestPurged } from '@github/domain/events/pull-request-purged.event';
import type { PullRequestReopened } from '@github/domain/events/pull-request-reopened.event';
import type { PullRequestReviewed } from '@github/domain/events/pull-request-reviewed.event';
import type { PullRequestUpdated } from '@github/domain/events/pull-request-updated.event';
import type { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import type { WorkspaceConnected } from '@github/domain/events/workspace-connected.event';
import {
  PULL_REQUEST_CLOSED,
  type PullRequestClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import {
  PULL_REQUEST_PURGED,
  type PullRequestPurgedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-purged.integration-event';
import {
  PULL_REQUEST_REOPENED,
  type PullRequestReopenedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-reopened.integration-event';
import {
  PULL_REQUEST_REVIEWED,
  type PullRequestReviewedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-reviewed.integration-event';
import {
  PULL_REQUEST_UPDATED,
  type PullRequestUpdatedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-updated.integration-event';
import {
  REVIEW_COMMENT_RECEIVED,
  type ReviewCommentReceivedIntegrationEvent,
} from '@shared-kernel/application/integration-events/review-comment-received.integration-event';
import {
  WORKSPACE_CONNECTED,
  type WorkspaceConnectedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-connected.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const GITHUB_EVENT_MAPPERS = [
  mapping<WorkspaceConnected>(
    'workspace.connected',
    (event): WorkspaceConnectedIntegrationEvent => ({
      kind: WORKSPACE_CONNECTED,
      workspaceId: event.workspaceId.value,
    }),
  ),
  mapping<ReviewCommentReceived>(
    'pull-request.review-comment-received',
    ({
      workspaceId,
      action,
      pullRequest,
      comment,
    }): ReviewCommentReceivedIntegrationEvent => ({
      kind: REVIEW_COMMENT_RECEIVED,
      workspaceId: workspaceId.value,
      action,
      pullRequest,
      commentId: comment.id,
      url: comment.url,
      path: comment.path,
      ...(comment.subject === 'file'
        ? { subject: 'file' as const }
        : {
            subject: 'line' as const,
            side: comment.side,
            line: comment.line,
            startLine: comment.startLine,
          }),
      body: comment.body,
      inReplyToId: comment.inReplyToId,
      login: comment.login,
      writtenAt: comment.writtenAt?.toISOString() ?? null,
    }),
  ),
  mapping<PullRequestClosed>(
    'pull-request.closed',
    (event): PullRequestClosedIntegrationEvent => ({
      kind: PULL_REQUEST_CLOSED,
      workspaceId: event.workspaceId.value,
      pullRequest: event.pullRequest,
      repository: event.repository,
      gitHubId: event.gitHubId,
      closedAt: event.closedAt?.toISOString() ?? null,
      ...(event.merge
        ? { merged: true, mergeCommit: event.merge.commit }
        : { merged: false, mergeCommit: null }),
    }),
  ),
  mapping<PullRequestReopened>(
    'pull-request.reopened',
    (event): PullRequestReopenedIntegrationEvent => ({
      kind: PULL_REQUEST_REOPENED,
      workspaceId: event.workspaceId.value,
      pullRequest: event.pullRequest,
      repository: event.repository,
      gitHubId: event.gitHubId,
      reopenedAt: event.reopenedAt?.toISOString() ?? null,
    }),
  ),
  mapping<PullRequestReviewed>(
    'pull-request.reviewed',
    (event): PullRequestReviewedIntegrationEvent => ({
      kind: PULL_REQUEST_REVIEWED,
      workspaceId: event.workspaceId.value,
      pullRequest: event.pullRequest,
      state: event.state,
      login: event.login,
      byBot: event.byBot,
      submittedAt: event.submittedAt?.toISOString() ?? null,
    }),
  ),
  mapping<PullRequestUpdated>(
    'pull-request.updated',
    ({ workspaceId, updated }): PullRequestUpdatedIntegrationEvent => ({
      kind: PULL_REQUEST_UPDATED,
      workspaceId: workspaceId.value,
      ...updated,
      openedAt: updated.openedAt.toISOString(),
      closedAt: updated.closedAt?.toISOString() ?? null,
      updatedAt: updated.updatedAt.toISOString(),
      readyForReviewAt: updated.readyForReviewAt?.toISOString() ?? null,
      draftPeriods: updated.draftPeriods.map((each) => ({
        from: each.from.toISOString(),
        to: each.to?.toISOString() ?? null,
      })),
      firstReviewAt: updated.firstReviewAt?.toISOString() ?? null,
      firstUnblockingReviewAt:
        updated.firstUnblockingReviewAt?.toISOString() ?? null,
      firstApprovedAt: updated.firstApprovedAt?.toISOString() ?? null,
      humanReviewedAt: updated.humanReviewedAt.map((each) =>
        each.toISOString(),
      ),
    }),
  ),
  mapping<PullRequestPurged>(
    'pull-request.purged',
    (event): PullRequestPurgedIntegrationEvent => ({
      kind: PULL_REQUEST_PURGED,
      workspaceId: event.workspaceId.value,
      pullRequest: event.pullRequest,
      updatedAt: event.updatedAt.toISOString(),
    }),
  ),
] as const;
