import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import { ChatRecord } from '@insights/domain/aggregates/chat-record.aggregate';
import type { ChatRecordRepository } from '@insights/domain/repositories/chat-record.repository';
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
    private readonly chats: ChatRecordRepository,
    private readonly deletions: DeletionsPort,
    private readonly transaction: TransactionPort,
  ) {}

  started(event: ChatStartedReceived): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const workspaceId = WorkspaceId.of(event.workspaceId);
      const teamId = TeamId.of(event.teamId);

      await this.deletions.lockDeletion(workspaceId, null, teamId);

      if (
        (await this.chats.of(event.chatId)) ||
        (await this.deletions.isDeleted(workspaceId, null, teamId))
      ) {
        return;
      }

      await this.chats.add(
        ChatRecord.start({
          chatId: event.chatId,
          workspaceId,
          teamId,
          startedBy: UserId.of(event.by),
          startedAt: new Date(event.at),
        }),
      );
    });
  }
}
