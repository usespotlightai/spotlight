import type { ObservedPullRequest } from '@insights/domain/value-objects/seen-pull-request.vo';
import type { PullRequestUpdatedIntegrationEvent } from '@shared-kernel/application/integration-events/pull-request-updated.integration-event';

const dateOf = (at: string | null): Date | null => (at ? new Date(at) : null);

export const observedPullRequestOf = (
  event: PullRequestUpdatedIntegrationEvent,
): ObservedPullRequest => ({
  repository: event.repository,
  number: event.number,
  title: event.title,
  author: event.author,
  authorIsBot: event.authorIsBot,
  branch: event.branch,
  additions: event.additions,
  deletions: event.deletions,
  changedFiles: event.changedFiles,
  openedAt: new Date(event.openedAt),
  state: event.state,
  closedAt: dateOf(event.closedAt),
  updatedAt: new Date(event.updatedAt),
  readyForReviewAt: dateOf(event.readyForReviewAt),
  draftPeriods: event.draftPeriods.map((each) => ({
    from: new Date(each.from),
    to: dateOf(each.to),
  })),
  reviews: event.reviews.map((each) => ({
    id: each.id,
    state: each.state,
    login: each.login,
    byBot: each.byBot,
    at: dateOf(each.submittedAt),
    dismissed: each.dismissed,
  })),
  reviewComments: event.reviewComments,
  botComments: event.botComments,
  threads: event.threads,
  isRevert: event.isRevert,
  revertedBy: event.revertedBy,
  version: event.version,
});
