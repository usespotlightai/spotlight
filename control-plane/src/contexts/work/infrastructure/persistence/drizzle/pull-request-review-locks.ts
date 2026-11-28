import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { PullRequestReviewLocksPort } from '@work/application/ports/pull-request-review-locks.port';
import { sql } from 'drizzle-orm';

@Injectable()
export class DrizzlePullRequestReviewLocks implements PullRequestReviewLocksPort {
  constructor(private readonly context: DrizzleContext) {}

  async lock(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<void> {
    if (!this.context.transacting) {
      throw new Error(
        'A lock on the reviews of a pull request needs a transaction',
      );
    }

    await this.context.db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`pull-request-reviews:${workspaceId.value}:${pullRequest.value}`}, 0))`,
    );
  }
}
