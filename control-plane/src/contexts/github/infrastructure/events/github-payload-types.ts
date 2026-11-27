import { PullRequestBaseMoved } from '@github/domain/events/pull-request-base-moved.event';
import { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import { PullRequestConflicted } from '@github/domain/events/pull-request-conflicted.event';
import { PullRequestPurged } from '@github/domain/events/pull-request-purged.event';
import { PullRequestPushed } from '@github/domain/events/pull-request-pushed.event';
import { PullRequestReopened } from '@github/domain/events/pull-request-reopened.event';
import { PullRequestRevertMerged } from '@github/domain/events/pull-request-revert-merged.event';
import { PullRequestUpdated } from '@github/domain/events/pull-request-updated.event';
import { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import { WorkspaceConnected } from '@github/domain/events/workspace-connected.event';
import { WorkspaceDisconnected } from '@github/domain/events/workspace-disconnected.event';
import { AuthorAssociation } from '@github/domain/value-objects/author-association.vo';
import { BotComment } from '@github/domain/value-objects/bot-comment.vo';
import { DraftPeriod } from '@github/domain/value-objects/draft-period.vo';
import { GitHubInstallation } from '@github/domain/value-objects/github-installation.vo';
import { InstallationPermissions } from '@github/domain/value-objects/installation-permissions.vo';
import { MergeabilityRead } from '@github/domain/value-objects/mergeability-read.vo';
import { PullRequestReview } from '@github/domain/value-objects/pull-request-review.vo';
import { PullRequestThread } from '@github/domain/value-objects/pull-request-thread.vo';

export const GITHUB_PAYLOAD_TYPES = [
  AuthorAssociation,
  BotComment,
  DraftPeriod,
  GitHubInstallation,
  InstallationPermissions,
  MergeabilityRead,
  PullRequestReview,
  PullRequestThread,
  WorkspaceConnected,
  WorkspaceDisconnected,
  ReviewCommentReceived,
  PullRequestClosed,
  PullRequestReopened,
  PullRequestPushed,
  PullRequestUpdated,
  PullRequestRevertMerged,
  PullRequestPurged,
  PullRequestBaseMoved,
  PullRequestConflicted,
] as const;
