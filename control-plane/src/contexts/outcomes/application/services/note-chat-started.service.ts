import type { ForgottenPort } from '@outcomes/application/ports/forgotten.port';
import { ChatRecord } from '@outcomes/domain/aggregates/chat-record.aggregate';
import type { ChatRecordRepository } from '@outcomes/domain/repositories/chat-record.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ChatStartedHeard {
  readonly chatId: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly by: string;
  readonly at: string;
}

export class NoteChatStarted {
  constructor(
    private readonly chats: ChatRecordRepository,
    private readonly forgotten: ForgottenPort,
    private readonly transaction: TransactionPort,
  ) {}

  started(heard: ChatStartedHeard): Promise<void> {
    return this.transaction.run(async () => {
      const workspaceId = WorkspaceId.of(heard.workspaceId);
      const teamId = TeamId.of(heard.teamId);

      await this.forgotten.holding(workspaceId, null, teamId);

      if (
        (await this.chats.of(heard.chatId)) ||
        (await this.forgotten.forgot(workspaceId, null, teamId))
      ) {
        return;
      }

      await this.chats.add(
        ChatRecord.started({
          chatId: heard.chatId,
          workspaceId,
          teamId,
          startedBy: UserId.of(heard.by),
          startedAt: new Date(heard.at),
        }),
      );
    });
  }
}
