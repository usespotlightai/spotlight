import { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import { PullRequestForgotten } from '@github/domain/events/pull-request-forgotten.event';
import { PullRequestRecorded } from '@github/domain/events/pull-request-recorded.event';
import { PullRequestRevertMerged } from '@github/domain/events/pull-request-revert-merged.event';
import { PullRequestReviewed } from '@github/domain/events/pull-request-reviewed.event';
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
  PullRequestRecorded,
  PullRequestRevertMerged,
  PullRequestForgotten,
] as const;
