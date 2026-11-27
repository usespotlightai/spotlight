import { ReactionDeferredError } from '@integrations/application/errors/reaction-deferred.error';
import type { DeliveryReactionsPort } from '@integrations/application/ports/delivery-reactions.port';
import type {
  ConflictedPullRequest,
  GitHubHappeningsPort,
} from '@integrations/application/ports/github-happenings.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class PullRequestConflictReactions {
  constructor(
    private readonly happenings: GitHubHappeningsPort,
    private readonly reactions: DeliveryReactionsPort,
    private readonly logger: LoggerPort,
  ) {}

  async conflicted(
    workspaceId: WorkspaceId,
    conflict: ConflictedPullRequest,
    key: string,
  ): Promise<void> {
    const failure = await this.reactions.react(
      workspaceId,
      null,
      this.happenings.conflicted(conflict),
      key,
    );

    if (failure?.transient) {
      throw new ReactionDeferredError(failure.reason);
    }

    if (failure) {
      this.logger.warn(
        {
          workspaceId: workspaceId.value,
          pullRequest: conflict.pullRequest,
          reason: failure.reason,
        },
        'Work could not react to a pull request that conflicts',
      );
    }
  }
}
