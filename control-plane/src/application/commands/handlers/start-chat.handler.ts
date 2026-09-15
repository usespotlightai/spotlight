import type { StartChatCommand } from '@application/commands/chat.commands';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { HarnessLaunchPort } from '@application/ports/harness-launch.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { ChatDispatching } from '@application/services/chat-dispatch';
import type { FilesAtHand } from '@application/services/files-at-hand.service';
import { Chat } from '@domain/aggregates/chat.aggregate';
import { UnknownHarnessError } from '@domain/exceptions/unknown-harness.error';
import type { ChatRepository } from '@domain/repositories/chat.repository';
import { Effort } from '@domain/value-objects/effort.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

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
    private readonly events: DomainEventDispatcher,
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
          id: this.ids.generate(),
          workspaceId,
          teamId: TeamId.of(member.teamId),
          startedBy,
          harness: HarnessId.of(command.harness),
          model: command.model ? HarnessModel.of(command.model) : null,
          effort: command.effort ? Effort.of(command.effort) : null,
          repositories: command.repositories.map((each) => Repository.of(each)),
          body: command.body,
          attachments,
          now: this.clock.now(),
        });

        const taken = await this.dispatch.takenUp(chat);
        await this.chats.add(taken);

        return taken;
      });

      await this.events.dispatch(started.pullEvents());

      return started.id.value;
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
