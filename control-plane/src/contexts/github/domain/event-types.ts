import { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import { PullRequestReviewed } from '@github/domain/events/pull-request-reviewed.event';
import { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import { WorkspaceConnected } from '@github/domain/events/workspace-connected.event';
import { WorkspaceDisconnected } from '@github/domain/events/workspace-disconnected.event';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';

export const GITHUB_EVENT_TYPES = [
  GitHubInstallation,
  WorkspaceConnected,
  WorkspaceDisconnected,
  ReviewCommentReceived,
  PullRequestClosed,
  PullRequestReviewed,
] as const;
