import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { StartChatCommand } from '@work/application/commands/chat.commands';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import type { FilesAtHand } from '@work/application/services/files-at-hand.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { UnknownHarnessError } from '@work/domain/exceptions/unknown-harness.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';

export class StartChatHandler
  implements CommandHandlerPort<StartChatCommand, string | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly chats: ChatRepository,
    private readonly files: FilesAtHand,
    private readonly dispatch: ChatDispatching,
    private readonly launch: HarnessLaunchPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: StartChatCommand): Promise<string | null> {
    try {
      const startedBy = UserId.of(command.startedBy);
      const member = await this.workspaces.findTeamForMember(
        command.teamId,
        startedBy,
      );

      if (!member) {
        return null;
      }

      if (
        !this.launch.catalogue().some((each) => each.id === command.harness)
      ) {
        throw new UnknownHarnessError(command.harness);
      }

      const workspaceId = WorkspaceId.of(member.workspaceId);

      const started = await this.transaction.run(async () => {
        const attachments = await this.files.handedOver(
          workspaceId,
          command.attachments,
        );

        const chat = Chat.start({
          workspaceId,
          teamId: TeamId.of(member.teamId),
          startedBy,
          harness: HarnessId.of(command.harness),
          model: command.model ? HarnessModel.of(command.model) : null,
          effort: command.effort ? Effort.of(command.effort) : null,
          repositories: command.repositories.map((each) => Repository.of(each)),
          body: ChatMessageBody.given(command.body, attachments),
          attachments,
          now: this.clock.now(),
          newId: () => this.ids.generate(),
        });

        const taken = await this.dispatch.takenUp(chat);
        await this.chats.add(taken);

        return taken;
      });

      return started.id.value;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
