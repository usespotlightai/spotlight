import type { PullRequestFactsPort } from '@insights/application/ports/pull-request-facts.port';
import type { PullRequestFact } from '@insights/domain/services/team-pull-requests';
import { pullRequestFact } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzlePullRequestFacts implements PullRequestFactsPort {
  constructor(private readonly context: DrizzleContext) {}

  async put(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    fact: PullRequestFact,
  ): Promise<void> {
    const columns = {
      type: fact.type,
      madeBy: fact.by,
      rounds: fact.rounds,
      mergedAt: fact.mergedAt,
    };

    await this.context.db
      .insert(pullRequestFact)
      .values({
        workspaceId: workspaceId.value,
        pullRequest: pullRequest.value,
        ...columns,
      })
      .onConflictDoUpdate({
        target: [pullRequestFact.workspaceId, pullRequestFact.pullRequest],
        set: columns,
      });
  }

  async drop(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
  ): Promise<void> {
    await this.context.db
      .delete(pullRequestFact)
      .where(
        and(
          eq(pullRequestFact.workspaceId, workspaceId.value),
          eq(pullRequestFact.pullRequest, pullRequest.value),
        ),
      );
  }
}
