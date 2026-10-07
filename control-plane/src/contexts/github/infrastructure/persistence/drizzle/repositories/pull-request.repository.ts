import { PullRequest } from '@github/domain/aggregates/pull-request.aggregate';
import { PullRequestMovedOnError } from '@github/domain/exceptions/pull-request-moved-on.error';
import type { PullRequestRepository } from '@github/domain/repositories/pull-request.repository';
import { githubPullRequest } from '@github/infrastructure/persistence/drizzle/schemas/pull-request.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, desc, eq, gt, lt, ne, or } from 'drizzle-orm';

type PullRequestRow = typeof githubPullRequest.$inferSelect;

const toPullRequest = (row: PullRequestRow): PullRequest =>
  PullRequest.rehydrate({
    workspaceId: WorkspaceId.of(row.workspaceId),
    url: PullRequestUrl.of(row.url),
    repository: Repository.of(row.repository),
    number: row.number,
    title: row.title,
    author: row.author,
    authorIsBot: row.authorIsBot,
    branch: row.branch,
    size:
      row.additions !== null &&
      row.deletions !== null &&
      row.changedFiles !== null
        ? {
            additions: row.additions,
            deletions: row.deletions,
            changedFiles: row.changedFiles,
          }
        : null,
    openedAt: row.openedAt,
    draft: row.draft,
    readyForReviewAt: row.readyForReviewAt,
    draftSpells: row.draftSpells.map((each) => ({
      from: new Date(each.from),
      to: each.to ? new Date(each.to) : null,
    })),
    state: row.state,
    closedAt: row.closedAt,
    updatedAt: row.updatedAt,
    reverts: row.reverts,
    reviews: row.reviews.map((each) => ({
      ...each,
      at: each.at ? new Date(each.at) : null,
    })),
    dismissedReviews: row.dismissedReviews,
    comments: row.comments,
    deletedComments: row.deletedComments,
    botComments: row.botComments,
    threads: row.threads,
    revertedBy: row.revertedBy ? PullRequestUrl.of(row.revertedBy) : null,
    version: row.version,
  });

const columnsOf = (pullRequest: PullRequest) => ({
  repository: pullRequest.repository.value,
  number: pullRequest.number,
  title: pullRequest.title,
  author: pullRequest.author,
  authorIsBot: pullRequest.authorIsBot,
  branch: pullRequest.branch,
  additions: pullRequest.size?.additions ?? null,
  deletions: pullRequest.size?.deletions ?? null,
  changedFiles: pullRequest.size?.changedFiles ?? null,
  openedAt: pullRequest.openedAt,
  draft: pullRequest.draft,
  readyForReviewAt: pullRequest.readyForReviewAt,
  draftSpells: pullRequest.draftSpells.map((each) => ({
    from: each.from.toISOString(),
    to: each.to?.toISOString() ?? null,
  })),
  state: pullRequest.state,
  closedAt: pullRequest.closedAt,
  updatedAt: pullRequest.updatedAt,
  reverts: pullRequest.reverts,
  reviews: pullRequest.reviews.map((each) => ({
    ...each,
    at: each.at?.toISOString() ?? null,
  })),
  dismissedReviews: [...pullRequest.dismissedReviews],
  comments: [...pullRequest.comments],
  deletedComments: [...pullRequest.deletedComments],
  botComments: [...pullRequest.botComments],
  threads: [...pullRequest.threads],
  revertedBy: pullRequest.revertedBy?.value ?? null,
});

const at = (workspaceId: WorkspaceId, url: PullRequestUrl) =>
  and(
    eq(githubPullRequest.workspaceId, workspaceId.value),
    eq(githubPullRequest.url, url.value),
  );

const pastOf = (after: PullRequest) =>
  or(
    gt(githubPullRequest.updatedAt, after.updatedAt),
    and(
      eq(githubPullRequest.updatedAt, after.updatedAt),
      gt(githubPullRequest.workspaceId, after.workspaceId.value),
    ),
    and(
      eq(githubPullRequest.updatedAt, after.updatedAt),
      eq(githubPullRequest.workspaceId, after.workspaceId.value),
      gt(githubPullRequest.url, after.url.value),
    ),
  );

@Injectable()
export class DrizzlePullRequests implements PullRequestRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async at(
    workspaceId: WorkspaceId,
    url: PullRequestUrl,
  ): Promise<PullRequest | null> {
    const [row] = await this.context.db
      .select()
      .from(githubPullRequest)
      .where(at(workspaceId, url))
      .limit(1);

    return row ? toPullRequest(row) : null;
  }

  async numbered(
    workspaceId: WorkspaceId,
    repository: Repository,
    number: number,
  ): Promise<PullRequest | null> {
    const [row] = await this.context.db
      .select()
      .from(githubPullRequest)
      .where(
        and(
          eq(githubPullRequest.workspaceId, workspaceId.value),
          eq(githubPullRequest.repository, repository.value),
          eq(githubPullRequest.number, number),
        ),
      )
      .limit(1);

    return row ? toPullRequest(row) : null;
  }

  async lastMergedTitled(
    workspaceId: WorkspaceId,
    repository: Repository,
    title: string,
  ): Promise<PullRequest | null> {
    const [row] = await this.context.db
      .select()
      .from(githubPullRequest)
      .where(
        and(
          eq(githubPullRequest.workspaceId, workspaceId.value),
          eq(githubPullRequest.repository, repository.value),
          eq(githubPullRequest.title, title),
          eq(githubPullRequest.state, 'merged'),
        ),
      )
      .orderBy(desc(githubPullRequest.closedAt))
      .limit(1);

    return row ? toPullRequest(row) : null;
  }

  async lastHeardBefore(
    before: Date,
    after: PullRequest | null,
    most: number,
  ): Promise<readonly PullRequest[]> {
    const rows = await this.context.db
      .select()
      .from(githubPullRequest)
      .where(
        and(
          or(
            and(
              ne(githubPullRequest.state, 'open'),
              lt(githubPullRequest.closedAt, before),
            ),
            and(
              eq(githubPullRequest.state, 'open'),
              lt(githubPullRequest.updatedAt, before),
            ),
          ),
          after ? pastOf(after) : undefined,
        ),
      )
      .orderBy(
        asc(githubPullRequest.updatedAt),
        asc(githubPullRequest.workspaceId),
        asc(githubPullRequest.url),
      )
      .limit(most);

    return rows.map(toPullRequest);
  }

  async ofWorkspace(
    workspaceId: WorkspaceId,
    after: PullRequestUrl | null,
    most: number,
  ): Promise<readonly PullRequest[]> {
    const rows = await this.context.db
      .select()
      .from(githubPullRequest)
      .where(
        and(
          eq(githubPullRequest.workspaceId, workspaceId.value),
          after ? gt(githubPullRequest.url, after.value) : undefined,
        ),
      )
      .orderBy(asc(githubPullRequest.url))
      .limit(most);

    return rows.map(toPullRequest);
  }

  async lockedAt(
    workspaceId: WorkspaceId,
    url: PullRequestUrl,
  ): Promise<PullRequest | null> {
    const [row] = await this.context.db
      .select()
      .from(githubPullRequest)
      .where(at(workspaceId, url))
      .limit(1)
      .for('update');

    return row ? toPullRequest(row) : null;
  }

  async lockedUnlessBusy(
    workspaceId: WorkspaceId,
    url: PullRequestUrl,
  ): Promise<PullRequest | null> {
    const [row] = await this.context.db
      .select()
      .from(githubPullRequest)
      .where(at(workspaceId, url))
      .limit(1)
      .for('update', { skipLocked: true });

    return row ? toPullRequest(row) : null;
  }

  async add(added: PullRequest): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .insert(githubPullRequest)
        .values({
          workspaceId: added.workspaceId.value,
          url: added.url.value,
          version: added.version + 1,
          ...columnsOf(added),
        })
        .onConflictDoNothing()
        .returning({ url: githubPullRequest.url });

      if (written.length === 0) {
        throw new PullRequestMovedOnError(added.url.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: PullRequest): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .update(githubPullRequest)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(
            at(saved.workspaceId, saved.url),
            eq(githubPullRequest.version, saved.version),
          ),
        )
        .returning({ url: githubPullRequest.url });

      if (written.length === 0) {
        throw new PullRequestMovedOnError(saved.url.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async remove(removed: PullRequest): Promise<void> {
    await this.context.run(async () => {
      const gone = await this.context.db
        .delete(githubPullRequest)
        .where(
          and(
            at(removed.workspaceId, removed.url),
            eq(githubPullRequest.version, removed.version),
          ),
        )
        .returning({ url: githubPullRequest.url });

      if (gone.length === 0) {
        throw new PullRequestMovedOnError(removed.url.value);
      }

      await this.events.dispatch(removed.pullEvents());
    });
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(githubPullRequest)
      .where(eq(githubPullRequest.workspaceId, workspaceId.value));
  }
}
