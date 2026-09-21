import type { DefaultBranchPushed } from '@github/domain/events/default-branch-pushed.event';
import type { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import type { WorkspaceConnected } from '@github/domain/events/workspace-connected.event';
import type { WorkspaceDisconnected } from '@github/domain/events/workspace-disconnected.event';
import {
  DEFAULT_BRANCH_PUSHED,
  type DefaultBranchPushedIntegrationEvent,
} from '@shared-kernel/application/integration-events/default-branch-pushed.integration-event';
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
      side: comment.side,
      line: comment.line,
      startLine: comment.startLine,
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
] as const;
