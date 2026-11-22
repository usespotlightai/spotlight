import type {
  NumberedPullRequest,
  PullRequestSummaryReaderPort,
  StoredPullRequestSummary,
} from '@github/application/ports/pull-request-summary-reader.port';
import { pullRequestStatusOf } from '@github/domain/value-objects/pull-request-state.vo';
import { githubPullRequest } from '@github/infrastructure/persistence/drizzle/schemas/pull-request.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, or } from 'drizzle-orm';

@Injectable()
export class DrizzlePullRequestSummaryReader
  implements PullRequestSummaryReaderPort
{
  constructor(private readonly context: DrizzleContext) {}

  async summariesOf(
    workspaceId: WorkspaceId,
    pullRequests: readonly NumberedPullRequest[],
  ): Promise<readonly StoredPullRequestSummary[]> {
    if (pullRequests.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select({
        repository: githubPullRequest.repository,
        number: githubPullRequest.number,
        state: githubPullRequest.state,
        draft: githubPullRequest.draft,
        title: githubPullRequest.title,
        author: githubPullRequest.author,
        authorIsBot: githubPullRequest.authorIsBot,
        additions: githubPullRequest.additions,
        deletions: githubPullRequest.deletions,
        changedFiles: githubPullRequest.changedFiles,
        updatedAt: githubPullRequest.updatedAt,
      })
      .from(githubPullRequest)
      .where(
        and(
          eq(githubPullRequest.workspaceId, workspaceId.value),
          or(
            ...pullRequests.map((each) =>
              and(
                eq(githubPullRequest.repository, each.repository.value),
                eq(githubPullRequest.number, each.number),
              ),
            ),
          ),
        ),
      );

    return rows.map((row) => ({
      repository: Repository.of(row.repository),
      number: row.number,
      state: pullRequestStatusOf(row.state, row.draft),
      title: row.title,
      author: row.author,
      authorIsBot: row.authorIsBot,
      additions: row.additions,
      deletions: row.deletions,
      changedFiles: row.changedFiles,
      updatedAt: row.updatedAt,
    }));
  }
}
