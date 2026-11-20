import type {
  NumberedPullRequest,
  PullRequestStatusReaderPort,
  PullRequestWithStatus,
} from '@github/application/ports/pull-request-status-reader.port';
import { pullRequestStatusOf } from '@github/domain/value-objects/pull-request-state.vo';
import { githubPullRequest } from '@github/infrastructure/persistence/drizzle/schemas/pull-request.schema';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, or } from 'drizzle-orm';

@Injectable()
export class DrizzlePullRequestStatusReader
  implements PullRequestStatusReaderPort
{
  constructor(private readonly context: DrizzleContext) {}

  async statusesOf(
    workspaceId: WorkspaceId,
    pullRequests: readonly NumberedPullRequest[],
  ): Promise<readonly PullRequestWithStatus[]> {
    if (pullRequests.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select({
        repository: githubPullRequest.repository,
        number: githubPullRequest.number,
        state: githubPullRequest.state,
        draft: githubPullRequest.draft,
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
      status: pullRequestStatusOf(row.state, row.draft),
    }));
  }
}
