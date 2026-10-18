import { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import { PullRequestPurged } from '@github/domain/events/pull-request-purged.event';
import { PullRequestRevertMerged } from '@github/domain/events/pull-request-revert-merged.event';
import { PullRequestReviewed } from '@github/domain/events/pull-request-reviewed.event';
import { PullRequestUpdated } from '@github/domain/events/pull-request-updated.event';
import { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import { WorkspaceConnected } from '@github/domain/events/workspace-connected.event';
import { WorkspaceDisconnected } from '@github/domain/events/workspace-disconnected.event';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';

export const GITHUB_PAYLOAD_TYPES = [
  GitHubInstallation,
  WorkspaceConnected,
  WorkspaceDisconnected,
  ReviewCommentReceived,
  PullRequestClosed,
  PullRequestReviewed,
  PullRequestUpdated,
  PullRequestRevertMerged,
  PullRequestPurged,
] as const;
