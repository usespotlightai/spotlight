import type { DefaultBranchPushed } from '@github/domain/events/default-branch-pushed.event';
import type { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import type { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import type { WorkspaceConnected } from '@github/domain/events/workspace-connected.event';
import type { WorkspaceDisconnected } from '@github/domain/events/workspace-disconnected.event';
import {
  DEFAULT_BRANCH_PUSHED,
  type DefaultBranchPushedIntegrationEvent,
} from '@shared-kernel/application/integration-events/default-branch-pushed.integration-event';
import {
  PULL_REQUEST_CLOSED,
  type PullRequestClosedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pull-request-closed.integration-event';
import {
  REVIEW_COMMENT_RECEIVED,
  type ReviewCommentReceivedIntegrationEvent,
} from '@shared-kernel/application/integration-events/review-comment-received.integration-event';
import {
  WORKSPACE_CONNECTED,
  type WorkspaceConnectedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-connected.integration-event';
import {
  WORKSPACE_DISCONNECTED,
  type WorkspaceDisconnectedIntegrationEvent,
} from '@shared-kernel/application/integration-events/workspace-disconnected.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

export const GITHUB_PUBLICATIONS = [
  publishing<WorkspaceConnected>(
    'workspace.connected',
    (event): WorkspaceConnectedIntegrationEvent => ({
      kind: WORKSPACE_CONNECTED,
      workspaceId: event.workspaceId.value,
    }),
  ),
  publishing<WorkspaceDisconnected>(
    'workspace.disconnected',
    (event): WorkspaceDisconnectedIntegrationEvent => ({
      kind: WORKSPACE_DISCONNECTED,
      workspaceId: event.workspaceId.value,
    }),
  ),
  publishing<ReviewCommentReceived>(
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
      answers: comment.answers,
      login: comment.login,
      writtenAt: comment.writtenAt?.toISOString() ?? null,
    }),
  ),
  publishing<DefaultBranchPushed>(
    'repository.default-branch-pushed',
    (event): DefaultBranchPushedIntegrationEvent => ({
      kind: DEFAULT_BRANCH_PUSHED,
      workspaceId: event.workspaceId.value,
      repository: event.repository,
      paths: event.paths,
    }),
  ),
  publishing<PullRequestClosed>(
    'pull-request.closed',
    (event): PullRequestClosedIntegrationEvent => ({
      kind: PULL_REQUEST_CLOSED,
      workspaceId: event.workspaceId.value,
      pullRequest: event.pullRequest,
      repository: event.repository,
      closedAt: event.closedAt?.toISOString() ?? null,
      ...(event.merge
        ? { merged: true, mergeCommit: event.merge.commit }
        : { merged: false, mergeCommit: null }),
    }),
  ),
] as const;
