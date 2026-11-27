import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';

export class TrackSetupPullRequests {
  constructor(
    private readonly chats: ChatRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async closed(
    workspaceId: WorkspaceId,
    pullRequest: PullRequestUrl,
    at: Date | null,
    merged: boolean,
  ): Promise<void> {
    await this.transaction.inTransaction(async () => {
      const chat = await this.chats.owningSetupPullRequest(
        workspaceId,
        pullRequest,
      );
      const closed =
        chat &&
        chat.setupPullRequestClosed(
          pullRequest,
          merged,
          at ?? this.clock.now(),
        );

      if (closed && closed !== chat) {
        await this.chats.save(closed);
      }
    });
  }
}
