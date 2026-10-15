import type { SeenPullRequest } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import type { pullRequestRecord } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';

export type PullRequestRow = typeof pullRequestRecord.$inferSelect;

export const seenOfRow = (row: PullRequestRow): SeenPullRequest | null =>
  row.seenVersion !== null &&
  row.repository !== null &&
  row.number !== null &&
  row.title !== null &&
  row.openedAt !== null &&
  row.updatedAt !== null &&
  row.state !== null
    ? {
        repository: row.repository,
        number: row.number,
        title: row.title,
        author: row.author,
        authorIsBot: row.authorIsBot,
        branch: row.branch,
        additions: row.additions,
        deletions: row.deletions,
        changedFiles: row.changedFiles,
        openedAt: row.openedAt,
        state: row.state,
        closedAt: row.closedAt,
        updatedAt: row.updatedAt,
        readyForReviewAt: row.readyForReviewAt,
        draftSpells: row.draftSpells.map((each) => ({
          from: new Date(each.from),
          to: each.to ? new Date(each.to) : null,
        })),
        firstReviewAt: row.firstReviewAt,
        firstUnblockingReviewAt: row.firstUnblockingReviewAt,
        firstApprovedAt: row.firstApprovedAt,
        humanReviewedAt: row.humanReviewedAt,
        reviews: row.reviews,
        reviewRounds: row.reviewRounds,
        reviewComments: row.reviewComments,
        botActivity: row.botActivity,
        isRevert: row.isRevert,
        revertedBy: row.revertedBy,
        version: row.seenVersion,
      }
    : null;
