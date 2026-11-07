import type { ChatsPort } from '@insights/application/ports/chats.port';
import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChatStartedReceived {
  readonly chatId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly by: string;
  readonly at: string;
}

export class RecordChat {
  constructor(
    private readonly chats: ChatsPort,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  started(event: ChatStartedReceived): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const workspaceId = WorkspaceId.of(event.workspaceId);
      const teamId = TeamId.of(event.teamId);
      const tombstones = await this.deletions.tombstonesOf(
        FactOwner.of(workspaceId, { teamId }),
      );

      if (!tombstones.acceptsFacts) {
        return;
      }

      await this.chats.note({
        chatId: event.chatId,
        workspaceId,
        teamId,
        startedBy: UserId.of(event.by),
        startedAt: new Date(event.at),
      });
    });
  }
}
